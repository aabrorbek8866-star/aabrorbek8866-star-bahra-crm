/**
 * Ma'lumotlar modeli (Database Schema).
 * PostgreSQL'dagi jadvallar: server/db/migrations/001_init.sql. API shu ko'rinishda qaytaradi.
 *
 * @typedef {Object} Apartment            — Xonadon
 * @property {number} id                  — Xonadon raqami (1..56)
 * @property {1|2}    entrance            — Podyezd raqami
 * @property {number} floor               — Qavat (1..7)
 * @property {number} area                — Maydoni, m²
 * @property {number} rooms               — Xonalar soni
 * @property {"sold"|"free"} status       — Holati: Sotilgan / Bo'sh
 * @property {number|null} clientId       — Egasi (Client.id)
 *
 * @typedef {Object} Client               — Mijoz
 * @property {number} id
 * @property {string} fullName            — F.I.O
 * @property {string} passport            — Pasport seriya/raqam
 * @property {string} phone               — Telefon raqami
 * @property {string} contractNumber      — Shartnoma raqami
 * @property {string} contractDate        — Shartnoma sanasi (YYYY-MM-DD)
 * @property {string|null} lastPaymentDate — Oxirgi to'lov sanasi (to'lovlardan hisoblanadi)
 * @property {string|null} contractPdfUrl — PDF shartnoma fayli URL manzili
 * @property {string|null} contractPdfName
 * @property {number} apartmentId
 * @property {number} totalPrice          — Shartnoma bo'yicha umumiy narx
 * @property {number} downPayment         — Boshlang'ich to'lov
 * @property {number} monthlyPayment      — Oylik to'lov
 * @property {number} installmentMonths   — Bo'lib to'lash muddati (oy)
 *
 * @typedef {Object} Payment              — To'lov tarixi
 * @property {number} id
 * @property {number} clientId            — Mijoz ID
 * @property {string} date                — To'lov sanasi (YYYY-MM-DD)
 * @property {"humo"|"uzcard"|"bank"|"cash"} type — To'lov turi
 * @property {number} amount              — To'lov summasi (so'm)
 * @property {string} comment             — Izoh (majburiy)
 * @property {string} createdAt
 */

export { BUILDING, locateApartment } from "../../shared/building.js";

export const PAYMENT_TYPES = {
  humo:   { label: "Humo terminal",     short: "Humo",   color: "#16a34a", badge: "bg-green-100 text-green-800" },
  uzcard: { label: "Uzcard terminal",   short: "Uzcard", color: "#2563eb", badge: "bg-blue-100 text-blue-800" },
  bank:   { label: "Bank o'tkazmasi",   short: "Bank",   color: "#7c3aed", badge: "bg-violet-100 text-violet-800" },
  cash:   { label: "Ofis (naqd)",       short: "Naqd",   color: "#ea580c", badge: "bg-orange-100 text-orange-800" },
};

export const APARTMENT_STATUS = {
  sold: { label: "Sotilgan", badge: "bg-emerald-100 text-emerald-800" },
  free: { label: "Bo'sh",    badge: "bg-slate-100 text-slate-700" },
};
