import { Router } from "express";
import { query } from "../db/pool.js";
import { requirePerm } from "../auth/middleware.js";
import { ah } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";
import { BUILDING } from "../../shared/building.js";

const router = Router();

/**
 * PATCH /api/apartments/:id  body: { area, rooms, totalArea?, livingArea?, scope }
 * scope: "one"      — faqat shu xonadon
 *        "entrance" — shu podyezddagi barcha qavatlarda xuddi shu o'rindagi xonadonlar
 *        "building" — ikkala podyezdda ham xuddi shu o'rindagi xonadonlar
 * O'rin = qavatdagi tartib raqami (1..4): 1-xonadon, 5-xonadon, 9-xonadon... bir xil o'rinda.
 */
router.patch("/:id", requirePerm("apartments:edit"), ah(async (req, res) => {
  const id = Number(req.params.id);
  const { scope = "one" } = req.body ?? {};
  const area = Number(req.body?.area);
  const rooms = Number(req.body?.rooms);
  const totalArea = Number(req.body?.totalArea) || 0;
  const livingArea = Number(req.body?.livingArea) || 0;

  if (!(id >= 1 && id <= BUILDING.total)) return res.status(404).json({ error: "Xonadon topilmadi" });
  if (!(area > 0 && area < 1000)) return res.status(400).json({ error: "Maydon 0 dan katta bo'lishi kerak (m²)" });
  if (!Number.isInteger(rooms) || rooms < 1 || rooms > 10) return res.status(400).json({ error: "Xonalar soni 1–10 oralig'ida bo'lishi kerak" });
  if (!["one", "entrance", "building"].includes(scope)) return res.status(400).json({ error: "Noto'g'ri qo'llash doirasi" });

  const { rows: [apt] } = await query("SELECT entrance FROM apartments WHERE id = $1", [id]);
  const position = (id - 1) % BUILDING.perFloor;
  const where =
    scope === "one" ? "id = $5"
    : scope === "entrance" ? "(id - 1) % $6 = $5 AND entrance = $7"
    : "(id - 1) % $6 = $5";
  const params =
    scope === "one" ? [id]
    : scope === "entrance" ? [position, BUILDING.perFloor, apt.entrance]
    : [position, BUILDING.perFloor];

  const { rows } = await query(
    `UPDATE apartments SET area = $1, rooms = $2, total_area = $3, living_area = $4 WHERE ${where} RETURNING id`,
    [area, rooms, totalArea, livingArea, ...params],
  );
  const ids = rows.map((r) => r.id).sort((a, b) => a - b);
  await audit(null, req.user.id, "update", "apartment", id, { area, rooms, totalArea, livingArea, scope, ids });
  res.json({ updated: ids });
}));

export default router;
