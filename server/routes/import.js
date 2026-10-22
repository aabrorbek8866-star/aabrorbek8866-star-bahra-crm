import { Router } from "express";
import { tx } from "../db/pool.js";
import { requirePerm } from "../auth/middleware.js";
import { ah } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";
import { BUILDING } from "../../shared/building.js";

const router = Router();
const TYPES = ["humo", "uzcard", "bank", "cash"];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s));
const int = (v) => Math.round(Number(v) || 0);

/**
 * POST /api/import  body: { apartments, clients, payments, mode: "merge" | "replace" }
 * Excel brauzerda o'qiladi (utils/excel.js), bu yerda qayta tekshirilib bitta tranzaksiyada yoziladi.
 *  - merge:   xonadon va mijozlar yangilanadi, PDF va mavjud to'lovlar saqlanadi, takroriy to'lovlar qo'shilmaydi
 *  - replace: barcha mijoz va to'lovlar o'chirilib, Exceldagi bilan almashtiriladi
 */
router.post("/", requirePerm("import"), ah(async (req, res) => {
  const { apartments = [], clients = [], payments = [], mode = "merge" } = req.body ?? {};
  const errors = [];

  for (const a of apartments) if (!(a.id >= 1 && a.id <= BUILDING.total)) errors.push(`Xonadon raqami noto'g'ri: ${a.id}`);
  const seenContracts = new Set();
  for (const c of clients) {
    if (!String(c.fullName ?? "").trim()) errors.push(`${c.apartmentId}-xonadon: F.I.O yo'q`);
    if (!isDate(c.contractDate)) errors.push(`${c.apartmentId}-xonadon: shartnoma sanasi noto'g'ri`);
    if (seenContracts.has(c.contractNumber)) errors.push(`Shartnoma raqami takrorlangan: ${c.contractNumber}`);
    seenContracts.add(c.contractNumber);
  }
  for (const p of payments) {
    if (!isDate(p.date) || !(int(p.amount) > 0) || !TYPES.includes(p.type)) errors.push(`To'lov xato: ${p.apartmentId}-xonadon, ${p.date}`);
  }
  if (errors.length) return res.status(400).json({ error: "Import ma'lumotlarida xatolar bor", details: errors.slice(0, 50) });

  const result = await tx(async (db) => {
    const warnings = [];
    if (mode === "replace") {
      await db.query("DELETE FROM payments");
      await db.query("UPDATE sms_log SET client_id = NULL");
      await db.query("DELETE FROM clients");
    }

    for (const a of apartments) {
      await db.query(
        `UPDATE apartments SET area = $2, rooms = $3, status = $4 WHERE id = $1`,
        [a.id, Number(a.area) || 0, int(a.rooms), a.status === "sold" ? "sold" : "free"],
      );
    }

    // Exceldagi mijozlar: xonadon raqami bo'yicha yangilash yoki qo'shish (PDF saqlanib qoladi)
    const idByApartment = new Map();
    for (const c of clients) {
      const { rows } = await db.query(
        `INSERT INTO clients (apartment_id, full_name, passport, phone, contract_number, contract_date, last_payment_date,
                              total_price, down_payment, monthly_payment, installment_months)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (apartment_id) DO UPDATE SET
           full_name = EXCLUDED.full_name, passport = EXCLUDED.passport, phone = EXCLUDED.phone,
           contract_number = EXCLUDED.contract_number, contract_date = EXCLUDED.contract_date,
           last_payment_date = COALESCE(EXCLUDED.last_payment_date, clients.last_payment_date),
           total_price = EXCLUDED.total_price, down_payment = EXCLUDED.down_payment,
           monthly_payment = EXCLUDED.monthly_payment, installment_months = EXCLUDED.installment_months,
           updated_at = now()
         RETURNING id`,
        [c.apartmentId, c.fullName.trim(), c.passport ?? "", c.phone ?? "", String(c.contractNumber).trim(), c.contractDate,
          isDate(c.lastPaymentDate) ? c.lastPaymentDate : null, int(c.totalPrice), int(c.downPayment),
          int(c.monthlyPayment), int(c.installmentMonths) || 24],
      );
      idByApartment.set(c.apartmentId, rows[0].id);
      await db.query("UPDATE apartments SET status = 'sold' WHERE id = $1", [c.apartmentId]);
    }

    // Excelda "Bo'sh" bo'lsa ham, bazada to'lovlari bor mijoz o'chirilmaydi — moliyaviy tarix yo'qolmasin
    const orphan = await db.query(
      `SELECT c.apartment_id, c.full_name FROM clients c WHERE NOT (c.apartment_id = ANY($1::int[]))`,
      [clients.map((c) => c.apartmentId)],
    );
    for (const o of orphan.rows) {
      await db.query("UPDATE apartments SET status = 'sold' WHERE id = $1", [o.apartment_id]);
      warnings.push(`${o.apartment_id}-xonadon Excelda bo'sh, lekin bazada mijoz bor (${o.full_name}) — mijoz saqlab qolindi.`);
    }

    // To'lovlar: bir xil to'lov qayta import qilinsa ikki marta yozilmasligi uchun import_key
    let inserted = 0, skipped = 0;
    const occurrences = new Map();
    for (const p of payments) {
      const clientId = idByApartment.get(p.apartmentId);
      if (!clientId) continue;
      const comment = String(p.comment ?? "").trim().length >= 3 ? String(p.comment).trim() : "Excel'dan import qilindi";
      const base = `${p.apartmentId}|${p.date}|${int(p.amount)}|${p.type}|${comment}`;
      const n = (occurrences.get(base) ?? 0) + 1;
      occurrences.set(base, n);
      const r = await db.query(
        `INSERT INTO payments (client_id, date, type, amount, comment, import_key, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (import_key) DO NOTHING`,
        [clientId, p.date, p.type, int(p.amount), comment, `${base}#${n}`, req.user.id],
      );
      r.rowCount ? inserted++ : skipped++;
    }

    await audit(db, req.user.id, "import", "excel", null, { mode, apartments: apartments.length, clients: clients.length, inserted, skipped });
    return { clients: clients.length, paymentsInserted: inserted, paymentsSkipped: skipped, warnings };
  });

  res.json(result);
}));

export default router;
