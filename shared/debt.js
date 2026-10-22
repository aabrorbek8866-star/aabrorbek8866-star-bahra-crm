// Qarzdorlik hisob-kitobi (frontend va backend uchun umumiy): shartnoma grafigi bo'yicha "shu kungacha to'lanishi kerak bo'lgan" summa
// bilan haqiqatda to'langan summani solishtiradi.

const addMonths = (iso, n) => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86_400_000);

/** To'lov grafigi: [{ date, amount, cumulative }] — 0-qator boshlang'ich to'lov. */
export function buildSchedule(client) {
  const rows = [{ date: client.contractDate, amount: client.downPayment, cumulative: client.downPayment }];
  let cum = client.downPayment;
  for (let m = 1; m <= client.installmentMonths; m++) {
    const amount = Math.min(client.monthlyPayment, Math.max(0, client.totalPrice - cum));
    if (amount <= 0) break;
    cum += amount;
    rows.push({ date: addMonths(client.contractDate, m), amount, cumulative: cum });
  }
  return rows;
}

/** Oxirgi to'lovdan shuncha kun o'tsa, grafigi kiritilmagan mijoz "to'lov to'xtagan" ro'yxatiga tushadi. */
export const STALE_DAYS = 30;

/**
 * Grafik (boshlang'ich + oylik to'lov) kiritilgan bo'lsa — muddati o'tgan qarz grafik bo'yicha hisoblanadi.
 * Kiritilmagan bo'lsa (masalan, eski Excel'dan import qilingan mijoz) — qarzni aniqlab bo'lmaydi;
 * buning o'rniga oxirgi to'lovdan beri qancha kun o'tgani kuzatiladi (stale).
 * @returns {{ paid, expected, debt, remaining, overdueDays, nextDue, isDebtor, hasSchedule, stale, daysSinceLastPayment, lastPaymentDate, progress }}
 */
export function calcClientDebt(client, payments, asOf = new Date().toISOString().slice(0, 10)) {
  const own = payments.filter((p) => p.clientId === client.id);
  const paid = own.reduce((s, p) => s + p.amount, 0);
  const lastPaymentDate = own.reduce((max, p) => (p.date > max ? p.date : max), "") || null;
  const schedule = buildSchedule(client);

  const dueRows = schedule.filter((r) => r.date <= asOf);
  const expected = dueRows.length ? dueRows[dueRows.length - 1].cumulative : 0;
  const debt = Math.max(0, expected - paid);

  // Birinchi to'lanmagan muddat — kechikish shu sanadan hisoblanadi
  const firstUnpaid = schedule.find((r) => r.cumulative > paid);
  const overdueDays = debt > 0 && firstUnpaid && firstUnpaid.date <= asOf ? daysBetween(firstUnpaid.date, asOf) : 0;
  const nextDue = schedule.find((r) => r.date > asOf) ?? null;

  const hasSchedule = client.monthlyPayment > 0 || client.downPayment > 0;
  const remaining = Math.max(0, client.totalPrice - paid);
  const sinceDate = lastPaymentDate ?? client.contractDate;
  const daysSinceLastPayment = sinceDate && sinceDate <= asOf ? daysBetween(sinceDate, asOf) : 0;

  return {
    paid,
    expected,
    debt,
    remaining,
    overdueDays,
    nextDue,
    lastPaymentDate,
    isDebtor: hasSchedule && debt > 0 && overdueDays > 0,
    hasSchedule,
    daysSinceLastPayment,
    stale: !hasSchedule && remaining > 0 && daysSinceLastPayment > STALE_DAYS,
    progress: client.totalPrice ? Math.min(100, (paid / client.totalPrice) * 100) : 0,
  };
}

export const debtSeverity = (days) =>
  days > 90 ? { label: "90+ kun", cls: "bg-red-600 text-white" }
  : days > 30 ? { label: "31–90 kun", cls: "bg-red-100 text-red-800" }
  : { label: "1–30 kun", cls: "bg-amber-100 text-amber-800" };
