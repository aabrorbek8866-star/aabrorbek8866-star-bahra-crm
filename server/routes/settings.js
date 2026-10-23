import { Router } from "express";
import { query } from "../db/pool.js";
import { requirePerm } from "../auth/middleware.js";
import { ah } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";

const router = Router();

/**
 * Soliq sozlamalari (taxminiy hisob uchun). Standart qiymatlar — 2026 yil uchun e'lon qilingan asosiy stavkalar:
 * aylanmadan olinadigan soliq 4%, QQS 12%, foyda solig'i 15%. Kompaniya rejimi buxgalter bilan tasdiqlanishi kerak.
 */
export const TAX_DEFAULTS = {
  regime: "turnover", // "turnover" — aylanmadan olinadigan soliq; "general" — QQS + foyda solig'i
  turnoverRate: 4,
  vatRate: 12,
  profitRate: 15,
  expenseShare: 0, // umumiy rejimda: tushumning necha foizi xarajat (foyda solig'ini taxminlash uchun)
  base: "payments", // "payments" — kelib tushgan to'lovlar; "notary" — notarius qilingan shartnomalar summasi
};

const clamp = (v, min, max, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

router.get("/", ah(async (_req, res) => {
  const { rows } = await query("SELECT key, value FROM settings");
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({ tax: { ...TAX_DEFAULTS, ...(map.tax ?? {}) } });
}));

router.put("/tax", requirePerm("settings:edit"), ah(async (req, res) => {
  const b = req.body ?? {};
  const tax = {
    regime: b.regime === "general" ? "general" : "turnover",
    turnoverRate: clamp(b.turnoverRate, 0, 50, TAX_DEFAULTS.turnoverRate),
    vatRate: clamp(b.vatRate, 0, 50, TAX_DEFAULTS.vatRate),
    profitRate: clamp(b.profitRate, 0, 50, TAX_DEFAULTS.profitRate),
    expenseShare: clamp(b.expenseShare, 0, 100, 0),
    base: b.base === "notary" ? "notary" : "payments",
  };
  await query(
    `INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('tax', $1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(tax), req.user.id],
  );
  await audit(null, req.user.id, "update", "settings", "tax", tax);
  res.json({ tax });
}));

export default router;
