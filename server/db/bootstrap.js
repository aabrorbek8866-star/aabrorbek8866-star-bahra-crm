import bcrypt from "bcryptjs";
import { query } from "./pool.js";
import { config } from "../config.js";
import { locateApartment, BUILDING } from "../../shared/building.js";

/** Birinchi ishga tushishda: 56 ta xonadonni yaratish va bosh administratorni qo'shish. */
export async function bootstrap() {
  const { rows } = await query("SELECT count(*)::int AS n FROM apartments");
  if (rows[0].n === 0) {
    for (let n = 1; n <= BUILDING.total; n++) {
      const { entrance, floor } = locateApartment(n);
      await query("INSERT INTO apartments (id, entrance, floor) VALUES ($1, $2, $3)", [n, entrance, floor]);
    }
    console.log(`[db] ${BUILDING.total} ta xonadon yaratildi`);
  }

  const users = await query("SELECT count(*)::int AS n FROM users");
  if (users.rows[0].n === 0) {
    let password = config.adminPassword;
    if (!password) {
      if (config.isProd) throw new Error("Birinchi ishga tushirish uchun .env da ADMIN_PASSWORD kerak");
      password = "admin12345";
    }
    if (password.length < 8) throw new Error("ADMIN_PASSWORD kamida 8 belgi bo'lishi kerak");
    await query(
      "INSERT INTO users (login, full_name, password_hash, role) VALUES ($1, $2, $3, 'admin')",
      [config.adminLogin, "Bosh administrator", await bcrypt.hash(password, 12)],
    );
    console.log(`[db] Administrator yaratildi: login "${config.adminLogin}"${config.isProd ? "" : ` / parol "${password}" (faqat dev)`}`);
  }
}
