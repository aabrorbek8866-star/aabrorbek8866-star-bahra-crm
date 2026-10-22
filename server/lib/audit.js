import { query } from "../db/pool.js";

/** Audit jurnaliga yozish. db — pool yoki tranzaksiya mijozi. */
export function audit(db, userId, action, entity, entityId, details) {
  return (db ?? { query }).query(
    "INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
    [userId, action, entity, entityId == null ? null : String(entityId), details ? JSON.stringify(details) : null],
  );
}
