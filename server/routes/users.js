import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";
import { requirePerm } from "../auth/middleware.js";
import { ROLES } from "../auth/permissions.js";
import { ah } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";

const router = Router();
router.use(requirePerm("users:manage"));

const toUser = (r) => ({ id: r.id, login: r.login, fullName: r.full_name, role: r.role, active: r.active, createdAt: r.created_at });

router.get("/", ah(async (_req, res) => {
  const { rows } = await query("SELECT id, login, full_name, role, active, created_at FROM users ORDER BY id");
  res.json(rows.map(toUser));
}));

router.post("/", ah(async (req, res) => {
  const { login, fullName, role, password } = req.body ?? {};
  const cleanLogin = String(login ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(cleanLogin)) return res.status(400).json({ error: "Login 3–32 ta lotin harfi/raqamdan iborat bo'lsin" });
  if (!String(fullName ?? "").trim()) return res.status(400).json({ error: "F.I.O kiritilmagan" });
  if (!ROLES[role]) return res.status(400).json({ error: "Noto'g'ri rol" });
  if (String(password ?? "").length < 8) return res.status(400).json({ error: "Parol kamida 8 belgi bo'lishi kerak" });

  const exists = await query("SELECT 1 FROM users WHERE login = $1", [cleanLogin]);
  if (exists.rowCount) return res.status(409).json({ error: "Bu login band" });

  const { rows } = await query(
    "INSERT INTO users (login, full_name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING *",
    [cleanLogin, fullName.trim(), role, await bcrypt.hash(password, 12)],
  );
  await audit(null, req.user.id, "create", "user", rows[0].id, { login: cleanLogin, role });
  res.status(201).json(toUser(rows[0]));
}));

router.patch("/:id", ah(async (req, res) => {
  const id = Number(req.params.id);
  const { fullName, role, active, password } = req.body ?? {};
  if (id === req.user.id && (active === false || (role && role !== "admin"))) {
    return res.status(400).json({ error: "O'zingizni o'chira yoki administratorlikdan chiqara olmaysiz" });
  }
  if (role !== undefined && !ROLES[role]) return res.status(400).json({ error: "Noto'g'ri rol" });
  if (password !== undefined && String(password).length < 8) return res.status(400).json({ error: "Parol kamida 8 belgi bo'lishi kerak" });

  const sets = [], vals = [];
  const add = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (fullName !== undefined) add("full_name", String(fullName).trim());
  if (role !== undefined) add("role", role);
  if (active !== undefined) add("active", Boolean(active));
  if (password !== undefined) add("password_hash", await bcrypt.hash(password, 12));
  if (!sets.length) return res.status(400).json({ error: "O'zgarish yo'q" });

  vals.push(id);
  const { rows } = await query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING *`, vals);
  if (!rows[0]) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });
  await audit(null, req.user.id, "update", "user", id, { fullName, role, active, passwordReset: password !== undefined || undefined });
  res.json(toUser(rows[0]));
}));

export default router;
