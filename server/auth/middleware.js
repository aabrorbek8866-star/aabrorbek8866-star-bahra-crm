import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import { PERMISSIONS } from "./permissions.js";

export const COOKIE = "bahra_session";

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: `${config.sessionHours}h` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "lax",
    maxAge: config.sessionHours * 3600 * 1000,
  });
}

/** Har so'rovda foydalanuvchini bazadan tekshiradi — o'chirilgan xodim darhol tizimdan chiqadi. */
export async function requireAuth(req, res, next) {
  try {
    const { sub } = jwt.verify(req.cookies?.[COOKIE] ?? "", config.jwtSecret);
    const { rows } = await query("SELECT id, login, full_name, role, active FROM users WHERE id = $1", [sub]);
    if (!rows[0]?.active) throw new Error("inactive");
    req.user = rows[0];
    next();
  } catch {
    res.clearCookie(COOKIE);
    res.status(401).json({ error: "Tizimga kiring" });
  }
}

export const can = (user, permission) => PERMISSIONS[permission]?.includes(user?.role);

export const requirePerm = (permission) => (req, res, next) =>
  can(req.user, permission) ? next() : res.status(403).json({ error: "Bu amal uchun huquqingiz yo'q" });
