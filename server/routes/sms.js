import { Router } from "express";
import { query } from "../db/pool.js";
import { requirePerm } from "../auth/middleware.js";
import { ah } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";
import { calcClientDebt } from "../../shared/debt.js";
import { fillSmsTemplate } from "../../shared/building.js";
import { CLIENT_COLUMNS, toClient } from "../lib/mappers.js";

// Eskiz.uz SMS shlyuzi. Boshqa provayder ishlatilsa, faqat sendSms() almashtiriladi.
const router = Router();
const ESKIZ = "https://notify.eskiz.uz/api";
let cachedToken = null;

const isConfigured = () => Boolean(process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD);

async function getToken() {
  if (cachedToken) return cachedToken;
  const form = new FormData();
  form.append("email", process.env.ESKIZ_EMAIL);
  form.append("password", process.env.ESKIZ_PASSWORD);
  const r = await fetch(`${ESKIZ}/auth/login`, { method: "POST", body: form });
  if (!r.ok) throw new Error(`Eskiz login xatosi: ${r.status}`);
  cachedToken = (await r.json()).data.token;
  return cachedToken;
}

async function sendSms(phone, message, retry = true) {
  const form = new FormData();
  form.append("mobile_phone", phone);
  form.append("message", message);
  form.append("from", process.env.ESKIZ_FROM || "4546");
  const r = await fetch(`${ESKIZ}/message/sms/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getToken()}` },
    body: form,
  });
  if (r.status === 401 && retry) {
    cachedToken = null; // token muddati tugagan
    return sendSms(phone, message, false);
  }
  if (!r.ok) throw new Error(`SMS yuborilmadi: ${r.status} ${await r.text()}`);
  return r.json();
}

const normalizePhone = (p = "") => {
  const digits = String(p).replace(/\D/g, "");
  return digits.length === 9 ? `998${digits}` : digits;
};

/**
 * POST /api/sms/send  body: { clientIds: number[], template: string }
 * Telefon va qarz summasi brauzerdan emas, bazadan olinadi — xabar soxtalashtirilmaydi.
 */
router.post("/send", requirePerm("sms:send"), ah(async (req, res) => {
  const { clientIds, template } = req.body ?? {};
  if (!Array.isArray(clientIds) || clientIds.length === 0) return res.status(400).json({ error: "Qabul qiluvchilar tanlanmagan" });
  if (!String(template ?? "").trim()) return res.status(400).json({ error: "Xabar matni bo'sh" });

  const { rows } = await query(`SELECT ${CLIENT_COLUMNS} FROM clients WHERE id = ANY($1::int[])`, [clientIds.map(Number)]);
  const pays = await query("SELECT client_id AS \"clientId\", date, amount FROM payments WHERE client_id = ANY($1::int[])", [clientIds.map(Number)]);

  const results = [];
  for (const row of rows) {
    const client = toClient(row);
    const debt = calcClientDebt(client, pays.rows);
    const phone = normalizePhone(client.phone);
    const message = fillSmsTemplate(template, { ...client, ...debt });
    let ok = false, error = null;

    if (phone.length !== 12) error = "Telefon raqami noto'g'ri";
    else {
      try {
        if (isConfigured()) await sendSms(phone, message);
        else console.log(`[SMS DRY-RUN] ${phone}: ${message}`);
        ok = true;
      } catch (e) {
        error = e.message;
      }
    }
    await query(
      "INSERT INTO sms_log (client_id, phone, message, ok, dry_run, error, sent_by) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [client.id, phone || client.phone, message, ok, !isConfigured(), error, req.user.id],
    );
    results.push({ clientId: client.id, fullName: client.fullName, ok, error });
  }
  await audit(null, req.user.id, "send", "sms", null, { count: results.length, ok: results.filter((r) => r.ok).length });
  res.json({ dryRun: !isConfigured(), results });
}));

export default router;
