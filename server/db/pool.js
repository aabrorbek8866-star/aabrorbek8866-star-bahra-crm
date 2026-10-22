import pg from "pg";
import { config } from "../config.js";

// BIGINT (so'mdagi summalar) → Number; DATE → "YYYY-MM-DD" satr (vaqt zonasi siljishisiz)
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000, // Neon "uyqudan" turishi uchun bir necha soniya kerak bo'lishi mumkin
});

// Neon bepul tarifida baza 5 daqiqa ishlatilmasa to'xtaydi va bo'sh ulanishlarni uzadi.
// Bu xato serverni to'xtatmasligi kerak — keyingi so'rovda pool yangi ulanish ochadi.
pool.on("error", (err) => console.warn("[db] bo'sh ulanish uzildi:", err.message));

export const query = (text, params) => pool.query(text, params);

/** Tranzaksiya ichida bajarish: xato bo'lsa hammasi bekor qilinadi. */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
