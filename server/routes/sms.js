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

// Nusxalashda qo'shilib qolgan bo'shliqlar olib tashlanadi
const env = (k) => String(process.env[k] ?? "").trim();
const isConfigured = () => Boolean(env("ESKIZ_EMAIL") && env("ESKIZ_PASSWORD"));

/** Eskiz serveriga so'rov; tarmoq xatosida sababi bilan tushunarli xabar. */
async function eskizFetch(url, init) {
  try {
    return await fetch(url, init);
  } catch (e) {
    const cause = e.cause ? ` (${e.cause.code ?? ""} ${e.cause.message ?? ""})`.replace(/\s+\)/, ")") : "";
    throw new Error(`Eskiz serveriga ulanib bo'lmadi${cause}`);
  }
}

/** Eskiz javobidagi xabarni o'qish (JSON bo'lsa — message, aks holda matn). */
async function eskizError(r, prefix) {
  const text = await r.text();
  let msg = text;
  try {
    const j = JSON.parse(text);
    msg = j.message ?? j.data?.message ?? j.error ?? text;
    if (typeof msg === "object") msg = JSON.stringify(msg);
  } catch { /* matn */ }
  return new Error(`${prefix} (${r.status}): ${String(msg).slice(0, 300)}`);
}

async function getToken() {
  if (cachedToken) return cachedToken;
  const form = new FormData();
  form.append("email", env("ESKIZ_EMAIL"));
  form.append("password", env("ESKIZ_PASSWORD"));
  const r = await eskizFetch(`${ESKIZ}/auth/login`, { method: "POST", body: form });
  if (!r.ok) throw await eskizError(r, "Eskiz'ga kirib bo'lmadi — ESKIZ_EMAIL / ESKIZ_PASSWORD ni tekshiring");
  cachedToken = (await r.json()).data.token;
  return cachedToken;
}

async function sendSms(phone, message, retry = true) {
  const form = new FormData();
  form.append("mobile_phone", phone);
  form.append("message", message);
  form.append("from", env("ESKIZ_FROM") || "4546");
  const r = await eskizFetch(`${ESKIZ}/message/sms/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getToken()}` },
    body: form,
  });
  if (r.status === 401 && retry) {
    cachedToken = null; // token muddati tugagan
    return sendSms(phone, message, false);
  }
  if (!r.ok) throw await eskizError(r, "Eskiz SMS'ni qabul qilmadi");
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

/**
 * GET /api/sms/diagnose — rahbar uchun: Eskiz'ga kirish ishlaydimi, balans qancha (parol ko'rsatilmaydi).
 */
router.get("/diagnose", requirePerm("users:manage"), ah(async (_req, res) => {
  if (!isConfigured()) return res.json({ configured: false });
  cachedToken = null;
  try {
    const token = await getToken();
    let balance = null;
    // Balans so'rovi ixtiyoriy: endpoint o'zgargan bo'lsa ham kirish tekshiruvi natijasi ko'rsatiladi
    try {
      const r = await eskizFetch(`${ESKIZ}/user/get-limit`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const j = await r.json();
        balance = j?.data?.balance ?? j?.balance ?? null;
      }
    } catch { /* balansni olib bo'lmadi */ }
    res.json({ configured: true, ok: true, email: env("ESKIZ_EMAIL"), from: env("ESKIZ_FROM") || "4546", balance });
  } catch (e) {
    res.json({ configured: true, ok: false, email: env("ESKIZ_EMAIL"), error: e.message });
  }
}));

/** POST /api/sms/test  body: { phone, message } — rahbar o'z raqamiga sinov SMS yuboradi. */
router.post("/test", requirePerm("users:manage"), ah(async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const message = String(req.body?.message ?? "").trim();
  if (phone.length !== 12) return res.status(400).json({ error: "Telefon raqami noto'g'ri (998XXXXXXXXX)" });
  if (!message) return res.status(400).json({ error: "Xabar matni bo'sh" });
  if (!isConfigured()) return res.status(400).json({ error: "Eskiz sozlanmagan: Render'da ESKIZ_EMAIL va ESKIZ_PASSWORD ni kiriting" });
  try {
    const result = await sendSms(phone, message);
    await query(
      "INSERT INTO sms_log (client_id, phone, message, ok, dry_run, sent_by) VALUES (NULL, $1, $2, TRUE, FALSE, $3)",
      [phone, message, req.user.id],
    );
    res.json({ ok: true, eskiz: result?.message ?? result?.status ?? null });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}));

export default router;
