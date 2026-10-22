import { Router } from "express";
import multer from "multer";
import { query, tx } from "../db/pool.js";
import { requirePerm } from "../auth/middleware.js";
import { ah } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";
import { CLIENT_COLUMNS, toClient } from "../lib/mappers.js";
import { BUILDING } from "../../shared/building.js";

const router = Router();
const TYPES = ["humo", "uzcard", "bank", "cash"];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s));
const money = (v) => Math.round(Number(String(v ?? "").replace(/\s/g, "")) || 0);

// Formadagi maydon → bazadagi ustun
const FIELDS = {
  fullName: "full_name",
  passport: "passport",
  phone: "phone",
  contractNumber: "contract_number",
  contractDate: "contract_date",
  totalPrice: "total_price",
  downPayment: "down_payment",
  monthlyPayment: "monthly_payment",
  installmentMonths: "installment_months",
  fullNameCyr: "full_name_cyr",
  jshshir: "jshshir",
  address: "address",
  passportIssuedBy: "passport_issued_by",
  passportIssuedAt: "passport_issued_at",
};

/** Mijoz ma'lumotlarini tekshirish. partial=true — faqat yuborilgan maydonlar. */
function validateClient(body, partial) {
  const v = {};
  const has = (k) => body[k] !== undefined;
  for (const k of ["fullName", "passport", "phone", "contractNumber"]) if (!partial || has(k)) v[k] = String(body[k] ?? "").trim();
  // Notarius hujjatlari uchun (ixtiyoriy)
  for (const k of ["fullNameCyr", "address", "passportIssuedBy"]) if (has(k)) v[k] = String(body[k] ?? "").trim();
  if (has("jshshir")) v.jshshir = String(body.jshshir ?? "").replace(/\D/g, "");
  if (has("passportIssuedAt")) v.passportIssuedAt = body.passportIssuedAt || null;
  if (!partial || has("contractDate")) v.contractDate = body.contractDate;
  for (const k of ["totalPrice", "downPayment", "monthlyPayment"]) if (!partial || has(k)) v[k] = money(body[k]);
  if (!partial || has("installmentMonths")) v.installmentMonths = Math.round(Number(body.installmentMonths) || 0);

  if (v.fullName !== undefined && v.fullName.length < 3) return { error: "F.I.O kiritilmagan" };
  if (v.contractNumber !== undefined && !v.contractNumber) return { error: "Shartnoma raqami kiritilmagan" };
  if (v.contractDate !== undefined && !isDate(v.contractDate)) return { error: "Shartnoma sanasi noto'g'ri" };
  if (v.passportIssuedAt && !isDate(v.passportIssuedAt)) return { error: "Pasport berilgan sana noto'g'ri" };
  if (v.jshshir && v.jshshir.length !== 14) return { error: "JSHSHIR 14 ta raqamdan iborat bo'lishi kerak" };
  for (const k of ["totalPrice", "downPayment", "monthlyPayment"]) if (v[k] !== undefined && v[k] < 0) return { error: "Summalar manfiy bo'lishi mumkin emas" };
  if (v.installmentMonths !== undefined && (v.installmentMonths < 0 || v.installmentMonths > 240)) return { error: "Muddat 0–240 oy oralig'ida bo'lishi kerak" };
  if (v.totalPrice !== undefined && v.downPayment !== undefined && v.downPayment > v.totalPrice && v.totalPrice > 0) {
    return { error: "Boshlang'ich to'lov shartnoma summasidan katta bo'lishi mumkin emas" };
  }
  return { value: v };
}

const fetchClient = async (id, db = { query }) =>
  (await db.query(`SELECT ${CLIENT_COLUMNS} FROM clients WHERE id = $1`, [id])).rows[0];

/** POST /api/clients — bo'sh xonadonni sotish: yangi mijoz qo'shish */
router.post("/", requirePerm("clients:edit"), ah(async (req, res) => {
  const apartmentId = Number(req.body?.apartmentId);
  if (!(apartmentId >= 1 && apartmentId <= BUILDING.total)) return res.status(400).json({ error: "Xonadon tanlanmagan" });
  const { value, error } = validateClient(req.body ?? {}, false);
  if (error) return res.status(400).json({ error });

  const created = await tx(async (db) => {
    const busy = await db.query("SELECT 1 FROM clients WHERE apartment_id = $1", [apartmentId]);
    if (busy.rowCount) return null;
    const cols = Object.keys(value);
    const { rows } = await db.query(
      `INSERT INTO clients (apartment_id, ${cols.map((k) => FIELDS[k]).join(", ")})
       VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")}) RETURNING id`,
      [apartmentId, ...cols.map((k) => value[k])],
    );
    await db.query("UPDATE apartments SET status = 'sold' WHERE id = $1", [apartmentId]);
    await audit(db, req.user.id, "create", "client", rows[0].id, { apartmentId, name: value.fullName, contract: value.contractNumber });
    return fetchClient(rows[0].id, db);
  });
  if (!created) return res.status(409).json({ error: "Bu xonadonda allaqachon mijoz bor" });
  res.status(201).json(toClient(created));
}));

/** PATCH /api/clients/:id — mijoz ma'lumotlarini tahrirlash (eski qiymatlar jurnalga yoziladi) */
router.patch("/:id", requirePerm("clients:edit"), ah(async (req, res) => {
  const id = Number(req.params.id);
  const { value, error } = validateClient(req.body ?? {}, true);
  if (error) return res.status(400).json({ error });
  const cols = Object.keys(value);
  if (!cols.length) return res.status(400).json({ error: "O'zgarish yo'q" });

  const before = await fetchClient(id);
  if (!before) return res.status(404).json({ error: "Mijoz topilmadi" });
  await query(
    `UPDATE clients SET ${cols.map((k, i) => `${FIELDS[k]} = $${i + 1}`).join(", ")}, updated_at = now() WHERE id = $${cols.length + 1}`,
    [...cols.map((k) => value[k]), id],
  );
  const prev = toClient(before);
  const changed = Object.fromEntries(cols.filter((k) => String(prev[k] ?? "") !== String(value[k])).map((k) => [k, { from: prev[k], to: value[k] }]));
  await audit(null, req.user.id, "update", "client", id, { name: value.fullName ?? prev.fullName, changed });
  res.json(toClient(await fetchClient(id)));
}));

/** DELETE /api/clients/:id — sotuvni bekor qilish (faqat to'lovlari yo'q mijoz) */
router.delete("/:id", requirePerm("clients:delete"), ah(async (req, res) => {
  const id = Number(req.params.id);
  const result = await tx(async (db) => {
    const c = (await db.query("SELECT apartment_id, full_name, contract_number FROM clients WHERE id = $1", [id])).rows[0];
    if (!c) return { status: 404, error: "Mijoz topilmadi" };
    const pays = await db.query("SELECT count(*)::int AS n FROM payments WHERE client_id = $1", [id]);
    if (pays.rows[0].n > 0) return { status: 409, error: `Mijozda ${pays.rows[0].n} ta to'lov bor. Avval to'lovlarni o'chiring yoki ma'lumotlarni tahrirlang.` };
    await db.query("UPDATE sms_log SET client_id = NULL WHERE client_id = $1", [id]);
    await db.query("DELETE FROM clients WHERE id = $1", [id]);
    await db.query("UPDATE apartments SET status = 'free' WHERE id = $1", [c.apartment_id]);
    await audit(db, req.user.id, "delete", "client", id, { apartmentId: c.apartment_id, name: c.full_name, contract: c.contract_number });
    return { ok: true };
  });
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
}));

/**
 * POST /api/clients/:id/payments/import — bitta mijozning to'lov jadvalini Excel'dan yuklash
 * body: { payments: [{ date, type, amount, comment }], totalPrice? }
 * Bir xil jadval qayta yuklansa, to'lovlar ikki marta yozilmaydi.
 */
router.post("/:id/payments/import", requirePerm("clients:edit"), ah(async (req, res) => {
  const id = Number(req.params.id);
  const { payments = [], totalPrice } = req.body ?? {};
  if (!Array.isArray(payments) || payments.length === 0) return res.status(400).json({ error: "To'lovlar topilmadi" });
  for (const p of payments) {
    if (!isDate(p.date) || !(money(p.amount) > 0) || !TYPES.includes(p.type)) {
      return res.status(400).json({ error: `Noto'g'ri qator: ${p.date} · ${p.amount}` });
    }
  }

  const result = await tx(async (db) => {
    const client = (await db.query("SELECT id, total_price FROM clients WHERE id = $1", [id])).rows[0];
    if (!client) return null;
    let inserted = 0, skipped = 0;
    const seen = new Map();
    for (const p of payments) {
      const comment = String(p.comment ?? "").trim().length >= 3 ? String(p.comment).trim() : "Excel'dan import qilindi";
      const base = `c${id}|${p.date}|${money(p.amount)}|${p.type}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      const r = await db.query(
        `INSERT INTO payments (client_id, date, type, amount, comment, import_key, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (import_key) DO NOTHING`,
        [id, p.date, p.type, money(p.amount), comment, `${base}#${n}`, req.user.id],
      );
      r.rowCount ? inserted++ : skipped++;
    }
    // Shartnoma summasi bazada bo'lmasa, jadvaldagidan olinadi
    if (money(totalPrice) > 0 && !client.total_price) {
      await db.query("UPDATE clients SET total_price = $1, updated_at = now() WHERE id = $2", [money(totalPrice), id]);
    }
    await audit(db, req.user.id, "import", "payment", id, { inserted, skipped });
    return { inserted, skipped };
  });
  if (!result) return res.status(404).json({ error: "Mijoz topilmadi" });
  res.json(result);
}));

// ---- PDF shartnoma ----

// PDF to'g'ridan-to'g'ri bazada (BYTEA) saqlanadi: server qayta o'rnatilsa ham yo'qolmaydi va zaxira nusxaga kiradi
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // bepul Neon bazasi 0.5 GB — fayllarni ixcham saqlaymiz
  fileFilter: (_req, file, cb) =>
    file.mimetype === "application/pdf" ? cb(null, true) : cb(new Error("Faqat PDF fayl qabul qilinadi")),
});

router.post("/:id/contract", requirePerm("contracts:upload"), upload.single("file"), ah(async (req, res) => {
  const id = Number(req.params.id);
  if (!req.file) return res.status(400).json({ error: "Fayl yuborilmadi" });
  if (req.file.buffer.subarray(0, 5).toString() !== "%PDF-") return res.status(400).json({ error: "Fayl PDF formatida emas" });

  const { rows } = await query(
    `UPDATE clients SET contract_pdf = $1, contract_pdf_name = $2, contract_pdf_at = now(), updated_at = now()
     WHERE id = $3 RETURNING ${CLIENT_COLUMNS}`,
    [req.file.buffer, req.file.originalname, id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Mijoz topilmadi" });
  await audit(null, req.user.id, "upload_contract", "client", id, { name: req.file.originalname, size: req.file.size });
  res.json(toClient(rows[0]));
}));

// ---- Notarius: notarial tasdiqlangan shartnoma (PDF) ----
// PDF yuklanganda mijoz "notarius qilingan" deb belgilanadi — PDF'siz belgilab bo'lmaydi.

router.post("/:id/notary", requirePerm("contracts:upload"), upload.single("file"), ah(async (req, res) => {
  const id = Number(req.params.id);
  if (!req.file) return res.status(400).json({ error: "Fayl yuborilmadi" });
  if (req.file.buffer.subarray(0, 5).toString() !== "%PDF-") return res.status(400).json({ error: "Fayl PDF formatida emas" });
  const date = isDate(req.body?.date) ? req.body.date : new Date().toISOString().slice(0, 10);

  const { rows } = await query(
    `UPDATE clients SET notary_pdf = $1, notary_pdf_name = $2, notary_pdf_at = now(), notarized = TRUE, notarized_at = $3, updated_at = now()
     WHERE id = $4 RETURNING ${CLIENT_COLUMNS}`,
    [req.file.buffer, req.file.originalname, date, id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Mijoz topilmadi" });
  await audit(null, req.user.id, "notarize", "client", id, { name: rows[0].full_name, date, file: req.file.originalname });
  res.json(toClient(rows[0]));
}));

router.delete("/:id/notary", requirePerm("clients:delete"), ah(async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query(
    `UPDATE clients SET notary_pdf = NULL, notary_pdf_name = NULL, notary_pdf_at = NULL, notarized = FALSE, notarized_at = NULL, updated_at = now()
     WHERE id = $1 RETURNING ${CLIENT_COLUMNS}`,
    [id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Mijoz topilmadi" });
  await audit(null, req.user.id, "unnotarize", "client", id, { name: rows[0].full_name });
  res.json(toClient(rows[0]));
}));

router.get("/:id/notary", ah(async (req, res) => {
  const { rows } = await query("SELECT notary_pdf, notary_pdf_name, apartment_id FROM clients WHERE id = $1", [Number(req.params.id)]);
  const row = rows[0];
  if (!row?.notary_pdf) return res.status(404).json({ error: "Notarial shartnoma yuklanmagan" });
  const name = row.notary_pdf_name || `Notarial_shartnoma_${row.apartment_id}-xonadon.pdf`;
  res.removeHeader("Content-Security-Policy");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.send(row.notary_pdf);
}));

/** Notarius hujjatlari tayyorlanganini jurnalga yozish (hujjat brauzerda yaratiladi). */
router.post("/:id/notary-docs", requirePerm("clients:edit"), ah(async (req, res) => {
  const id = Number(req.params.id);
  const c = (await query("SELECT full_name FROM clients WHERE id = $1", [id])).rows[0];
  if (!c) return res.status(404).json({ error: "Mijoz topilmadi" });
  await audit(null, req.user.id, "notary_docs", "client", id, { name: c.full_name, date: req.body?.date });
  res.json({ ok: true });
}));

router.get("/:id/contract", ah(async (req, res) => {
  const { rows } = await query("SELECT contract_pdf, contract_pdf_name, contract_number FROM clients WHERE id = $1", [Number(req.params.id)]);
  const row = rows[0];
  if (!row?.contract_pdf) return res.status(404).json({ error: "Shartnoma fayli yo'q" });
  const name = row.contract_pdf_name || `Shartnoma_${row.contract_number}.pdf`;
  res.removeHeader("Content-Security-Policy"); // brauzerning PDF ko'ruvchisi to'sib qo'yilmasin
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.send(row.contract_pdf);
}));

export default router;
