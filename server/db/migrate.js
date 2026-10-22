import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

/** migrations/ dagi hali bajarilmagan .sql fayllarni tartib bilan, har birini tranzaksiyada bajaradi. */
export async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const done = new Set((await pool.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await fs.readFile(path.join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`[db] migratsiya bajarildi: ${file}`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw new Error(`Migratsiya ${file} xatosi: ${e.message}`);
    } finally {
      client.release();
    }
  }
}
