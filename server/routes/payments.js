import { Router } from "express";
import { query } from "../db/pool.js";
import { requirePerm } from "../auth/middleware.js";
import { ah } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";
import { PAYMENT_COLUMNS, PAYMENT_JOINS, toPayment } from "../lib/mappers.js";
import { isRealIsoDate } from "../../shared/date.js";

const router = Router();
const TYPES = ["humo", "uzcard", "bank", "cash"];
const today = () => new Date().toISOString().slice(0, 10);

function validate(body, partial = false) {
  const out = {};
  const { date, type, amount, comment } = body ?? {};
  if (!partial || date !== undefined) {
    if (!isRealIsoDate(date) || date > today()) return { error: "Sana noto'g'ri yoki kelajakda" };
    out.date = date;
  }
  if (!partial || type !== undefined) {
    if (!TYPES.includes(type)) return { error: "To'lov turi noto'g'ri" };
    out.type = type;
  }
  if (!partial || amount !== undefined) {
    const n = Number(amount);
    if (!Number.isSafeInteger(n) || n <= 0) return { error: "Summa musbat butun son bo'lishi kerak" };
    out.amount = n;
  }
  if (!partial || comment !== undefined) {
    if (String(comment ?? "").trim().length < 3) return { error: "Izoh majburiy (kamida 3 belgi)" };
    out.comment = String(comment).trim();
  }
  return { value: out };
}

const fetchOne = async (id) =>
  (await query(`SELECT ${PAYMENT_COLUMNS} FROM payments p ${PAYMENT_JOINS} WHERE p.id = $1`, [id])).rows[0];

router.post("/", requirePerm("payments:create"), ah(async (req, res) => {
  const { value, error } = validate(req.body);
  if (error) return res.status(400).json({ error });
  const clientId = Number(req.body.clientId);
  const client = await query("SELECT id FROM clients WHERE id = $1", [clientId]);
  if (!client.rowCount) return res.status(404).json({ error: "Mijoz topilmadi" });

  const { rows } = await query(
    `INSERT INTO payments (client_id, date, type, amount, comment, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [clientId, value.date, value.type, value.amount, value.comment, req.user.id],
  );
  await audit(null, req.user.id, "create", "payment", rows[0].id, { clientId, ...value });
  res.status(201).json(toPayment(await fetchOne(rows[0].id)));
}));

router.patch("/:id", requirePerm("payments:update"), ah(async (req, res) => {
  const id = Number(req.params.id);
  const { value, error } = validate(req.body, true);
  if (error) return res.status(400).json({ error });
  const before = (await query("SELECT date, type, amount, comment FROM payments WHERE id = $1", [id])).rows[0];
  if (!before) return res.status(404).json({ error: "To'lov topilmadi" });

  const cols = Object.keys(value);
  if (!cols.length) return res.status(400).json({ error: "O'zgarish yo'q" });
  await query(
    `UPDATE payments SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(", ")}, updated_by = $${cols.length + 1}, updated_at = now()
     WHERE id = $${cols.length + 2}`,
    [...cols.map((c) => value[c]), req.user.id, id],
  );
  // Moliyaviy nazorat uchun eski va yangi qiymatlar jurnalga yoziladi
  await audit(null, req.user.id, "update", "payment", id, { before, after: value });
  res.json(toPayment(await fetchOne(id)));
}));

router.delete("/:id", requirePerm("payments:delete"), ah(async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query("DELETE FROM payments WHERE id = $1 RETURNING client_id, date, type, amount, comment", [id]);
  if (!rows[0]) return res.status(404).json({ error: "To'lov topilmadi" });
  await audit(null, req.user.id, "delete", "payment", id, rows[0]);
  res.json({ ok: true });
}));

export default router;
