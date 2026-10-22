import { Router } from "express";
import { query } from "../db/pool.js";
import { requirePerm } from "../auth/middleware.js";
import { ah } from "../lib/asyncHandler.js";

const router = Router();

router.get("/", requirePerm("audit:view"), ah(async (req, res) => {
  const limit = Math.min(500, Number(req.query.limit) || 200);
  const { rows } = await query(
    `SELECT l.id, l.action, l.entity, l.entity_id, l.details, l.at, u.full_name AS user_name
     FROM audit_log l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.at DESC LIMIT $1`,
    [limit],
  );
  res.json(rows.map((r) => ({ id: r.id, action: r.action, entity: r.entity, entityId: r.entity_id, details: r.details, at: r.at, user: r.user_name })));
}));

export default router;
