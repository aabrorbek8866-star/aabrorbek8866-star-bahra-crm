import { MONTHS_UZ } from "./format";
import { PAYMENT_TYPES } from "../data/schema";

const startOfWeek = (d) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // dushanba = 0
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
};

/**
 * Tushumlarni davr bo'yicha guruhlash.
 * @param {"week"|"month"|"year"} period
 * @returns {{ key, label, total, humo, uzcard, bank, cash }[]}
 */
export function groupRevenue(payments, period, limit) {
  const map = new Map();
  for (const p of payments) {
    let key, label;
    if (period === "week") {
      key = startOfWeek(p.date);
      label = `${key.slice(8, 10)}.${key.slice(5, 7)}`;
    } else if (period === "month") {
      key = p.date.slice(0, 7);
      label = `${MONTHS_UZ[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`;
    } else {
      key = p.date.slice(0, 4);
      label = key;
    }
    const row = map.get(key) ?? { key, label, total: 0, humo: 0, uzcard: 0, bank: 0, cash: 0 };
    row.total += p.amount;
    row[p.type] += p.amount;
    map.set(key, row);
  }
  const rows = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  const defaultLimit = { week: 12, month: 12, year: 10 }[period];
  return rows.slice(-(limit ?? defaultLimit));
}

export function revenueByType(payments) {
  return Object.entries(PAYMENT_TYPES).map(([type, meta]) => ({
    type,
    name: meta.label,
    color: meta.color,
    value: payments.filter((p) => p.type === type).reduce((s, p) => s + p.amount, 0),
  }));
}

/** Joriy va oldingi davr summalarini solishtirish (KPI kartochkalar uchun). */
export function periodTotals(payments, now = new Date()) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const sum = (from, to) => payments.filter((p) => p.date >= from && p.date < to).reduce((s, p) => s + p.amount, 0);
  const shift = (days) => { const d = new Date(now); d.setDate(d.getDate() + days); return iso(d); };
  const tomorrow = shift(1);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);

  return {
    week: { value: sum(shift(-6), tomorrow), prev: sum(shift(-13), shift(-6)) },
    month: { value: sum(iso(monthStart), tomorrow), prev: sum(iso(prevMonthStart), iso(monthStart)) },
    year: { value: sum(iso(yearStart), tomorrow), prev: sum(iso(prevYearStart), iso(yearStart)) },
    all: payments.reduce((s, p) => s + p.amount, 0),
  };
}

/** Oylar bo'yicha sotuvlar soni (shartnoma sanasi bo'yicha). */
export function salesByMonth(clients, limit = 18) {
  const map = new Map();
  for (const c of clients) {
    const key = c.contractDate.slice(0, 7);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-limit)
    .map(([key, count]) => ({ key, label: `${MONTHS_UZ[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`, count }));
}
