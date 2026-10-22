import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { query } from "../db/pool.js";
import { COOKIE, issueSession, requireAuth } from "../auth/middleware.js";
import { permissionsFor, ROLES } from "../auth/permissions.js";
import { ah } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";

const router = Router();

// Parol tanlashga (brute-force) qarshi: 15 daqiqada 10 ta urinish
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "Juda ko'p urinish. 15 daqiqadan so'ng qayta urinib ko'ring." } });

const publicUser = (u) => ({ id: u.id, login: u.login, fullName: u.full_name, role: u.role, roleLabel: ROLES[u.role], permissions: permissionsFor(u.role) });

router.post("/login", loginLimiter, ah(async (req, res) => {
  const { login, password } = req.body ?? {};
  const { rows } = await query("SELECT * FROM users WHERE login = $1", [String(login ?? "").trim().toLowerCase()]);
  const user = rows[0];
  const ok = user?.active && (await bcrypt.compare(String(password ?? ""), user.password_hash));
  if (!ok) return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
  issueSession(res, user);
  await audit(null, user.id, "login", "user", user.id);
  res.json(publicUser(user));
}));

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => res.json(publicUser(req.user)));

router.post("/password", requireAuth, ah(async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (String(newPassword ?? "").length < 8) return res.status(400).json({ error: "Yangi parol kamida 8 belgi bo'lishi kerak" });
  const { rows } = await query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
  if (!(await bcrypt.compare(String(currentPassword ?? ""), rows[0].password_hash))) {
    return res.status(400).json({ error: "Joriy parol noto'g'ri" });
  }
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(newPassword, 12), req.user.id]);
  await audit(null, req.user.id, "password_change", "user", req.user.id);
  res.json({ ok: true });
}));

export default router;
