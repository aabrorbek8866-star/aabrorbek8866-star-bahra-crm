// Dev uchun: bazani demo ma'lumotlar bilan to'ldirish.  npm run db:demo
// DIQQAT: mavjud mijoz va to'lovlarni o'chiradi.
import { buildSeed } from "../../src/data/seed.js";
import { pool, tx } from "./pool.js";
import { migrate } from "./migrate.js";
import { bootstrap } from "./bootstrap.js";

if (process.env.NODE_ENV === "production") throw new Error("Demo ma'lumotlarni production bazaga yuklab bo'lmaydi");

await migrate();
await bootstrap();
const { apartments, clients, payments } = buildSeed();

await tx(async (db) => {
  await db.query("DELETE FROM payments; UPDATE sms_log SET client_id = NULL; DELETE FROM clients;");
  for (const a of apartments) {
    await db.query("UPDATE apartments SET area=$2, rooms=$3, status=$4 WHERE id=$1", [a.id, a.area, a.rooms, a.status]);
  }
  const ids = new Map();
  for (const c of clients) {
    const { rows } = await db.query(
      `INSERT INTO clients (apartment_id, full_name, passport, phone, contract_number, contract_date, total_price,
        down_payment, monthly_payment, installment_months) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [c.apartmentId, c.fullName, c.passport, c.phone, c.contractNumber, c.contractDate, c.totalPrice, c.downPayment, c.monthlyPayment, c.installmentMonths],
    );
    ids.set(c.id, rows[0].id);
  }
  for (const p of payments) {
    await db.query("INSERT INTO payments (client_id, date, type, amount, comment) VALUES ($1,$2,$3,$4,$5)",
      [ids.get(p.clientId), p.date, p.type, p.amount, p.comment]);
  }
});
console.log(`Demo: ${clients.length} mijoz, ${payments.length} to'lov yuklandi`);
await pool.end();
