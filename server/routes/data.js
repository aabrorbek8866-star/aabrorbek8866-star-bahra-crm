import { Router } from "express";
import { query } from "../db/pool.js";
import { ah } from "../lib/asyncHandler.js";
import { CLIENT_COLUMNS, PAYMENT_COLUMNS, PAYMENT_JOINS, toApartment, toClient, toPayment } from "../lib/mappers.js";

const router = Router();

/**
 * GET /api/data — butun CRM holati bitta so'rovda (56 xonadon, mijozlar, to'lovlar, so'nggi SMSlar).
 * Obyekt hajmi kichik bo'lgani uchun hisob-kitoblar (qarz, grafiklar) frontendda bajariladi.
 */
router.get("/", ah(async (_req, res) => {
  const [apartments, clients, payments, sms] = await Promise.all([
    query(`SELECT a.*, c.id AS client_id FROM apartments a LEFT JOIN clients c ON c.apartment_id = a.id ORDER BY a.id`),
    query(`SELECT ${CLIENT_COLUMNS} FROM clients ORDER BY apartment_id`),
    query(`SELECT ${PAYMENT_COLUMNS} FROM payments p ${PAYMENT_JOINS} ORDER BY p.date, p.id`),
    query(`SELECT client_id, ok, dry_run, sent_at FROM sms_log ORDER BY sent_at DESC LIMIT 500`),
  ]);
  res.json({
    apartments: apartments.rows.map(toApartment),
    clients: clients.rows.map(toClient),
    payments: payments.rows.map(toPayment),
    smsLog: sms.rows.map((r) => ({ clientId: r.client_id, ok: r.ok, dryRun: r.dry_run, at: r.sent_at })),
  });
}));

export default router;
