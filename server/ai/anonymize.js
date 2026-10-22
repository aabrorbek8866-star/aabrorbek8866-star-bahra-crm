// Tashqi (bepul) AI xizmatiga yuborishdan oldin shaxsiy ma'lumotlarni olib tashlash:
// mijoz ismi → "№46-xonadon mijozi", telefon raqamlari o'chiriladi.
import { query } from "../db/pool.js";
import { toCyrillic } from "../../shared/notary.js";

const placeholder = (apt) => `№${apt}-xonadon mijozi`;

/** CRM "surati"dagi fio va telefonlarni almashtirish. */
export function anonymizeContext(value) {
  if (Array.isArray(value)) return value.map(anonymizeContext);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "telefon") continue;
      if (k === "fio") out[k] = value.xonadon ? placeholder(value.xonadon) : "mijoz";
      else out[k] = anonymizeContext(v);
    }
    return out;
  }
  return value;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Foydalanuvchi xabarlaridagi mijoz ismlarini (to'liq yoki familiya + ism) va telefon raqamlarini almashtirish.
 * Masalan, "Raxmatova Xolida Samadjonovna uchun pretenziya" → "№46-xonadon mijozi uchun pretenziya".
 */
export async function anonymizeMessages(messages) {
  const { rows } = await query("SELECT apartment_id, full_name, full_name_cyr FROM clients");
  const patterns = [];
  for (const r of rows) {
    // Lotin, saqlangan kirill va avtomatik kirill shakllari ("Raxmatova" / "Рахматова")
    for (const name of new Set([r.full_name, r.full_name_cyr, toCyrillic(r.full_name)])) {
      const words = String(name ?? "").trim().split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        patterns.push([new RegExp(escapeRe(words.join(" ")), "gi"), placeholder(r.apartment_id)]);
        patterns.push([new RegExp(escapeRe(words.slice(0, 2).join(" ")), "gi"), placeholder(r.apartment_id)]);
      }
    }
  }
  // Uzunroq nomlar avval almashtirilsin
  patterns.sort((a, b) => b[0].source.length - a[0].source.length);
  return messages.map((m) => {
    let text = m.content;
    for (const [re, rep] of patterns) text = text.replace(re, rep);
    text = text.replace(/\+?998[\s-]?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g, "[telefon]");
    return { ...m, content: text };
  });
}

export const PRIVACY_NOTE = `
Maxfiylik: mijozlarning ismlari va telefonlari sizga yuborilmagan — ular "№N-xonadon mijozi" deb ko'rsatilgan.
Javobda ismlarni to'qib chiqarmang; hujjat (masalan, pretenziya xati) tayyorlasangiz, ism o'rniga "[Mijoz F.I.Sh.]" deb joy qoldiring.`;
