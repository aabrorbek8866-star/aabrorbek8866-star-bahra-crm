// Soliqni taxminiy hisoblash (buxgalteriya hisobi o'rnini bosmaydi).

/** Joriy oy, chorak va yil chegaralari: [from, to) — "yyyy-mm-dd". */
export function taxPeriods(now = new Date()) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const y = now.getFullYear();
  const m = now.getMonth();
  const q = Math.floor(m / 3);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  return [
    { id: "month", label: `${MONTHS[m]} oyi`, from: iso(new Date(Date.UTC(y, m, 1))), to: iso(tomorrow) },
    { id: "quarter", label: `${q + 1}-chorak`, from: iso(new Date(Date.UTC(y, q * 3, 1))), to: iso(tomorrow) },
    { id: "year", label: `${y} yil`, from: iso(new Date(Date.UTC(y, 0, 1))), to: iso(tomorrow) },
  ];
}

/** Soliq bazasi: davrda kelib tushgan to'lovlar yoki notarius qilingan shartnomalar summasi. */
export function taxBase(settings, { payments, clients }, period) {
  if (settings.base === "notary") {
    return clients
      .filter((c) => c.notarized && c.notarizedAt >= period.from && c.notarizedAt < period.to)
      .reduce((s, c) => s + (c.notaryAmount || c.totalPrice || 0), 0);
  }
  return payments.filter((p) => p.date >= period.from && p.date < period.to).reduce((s, p) => s + p.amount, 0);
}

/**
 * @returns {{ lines: {label, amount, hint?}[], total: number }}
 * Aylanma rejimi: baza × stavka.
 * Umumiy rejim: QQS narx ichida (baza × st / (100 + st)); foyda solig'i — xarajatlar ulushi kiritilgan bo'lsa.
 */
export function taxEstimate(settings, base) {
  if (settings.regime === "turnover") {
    const amount = Math.round((base * settings.turnoverRate) / 100);
    return { lines: [{ label: `Aylanmadan olinadigan soliq (${settings.turnoverRate}%)`, amount }], total: amount };
  }
  const vat = Math.round((base * settings.vatRate) / (100 + settings.vatRate));
  const lines = [{ label: `QQS (${settings.vatRate}%, narx ichida)`, amount: vat }];
  if (settings.expenseShare > 0) {
    const net = base - vat;
    const profit = net - (net * settings.expenseShare) / 100;
    lines.push({
      label: `Foyda solig'i (${settings.profitRate}%)`,
      amount: Math.max(0, Math.round((profit * settings.profitRate) / 100)),
      hint: `xarajatlar ${settings.expenseShare}% deb olingan`,
    });
  }
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
}
