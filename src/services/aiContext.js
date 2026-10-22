import { groupRevenue, periodTotals, revenueByType, salesByMonth } from "../utils/analytics";

/**
 * AI agentlarga yuboriladigan ixcham ma'lumotlar "surati".
 * Pasport ma'lumotlari ataylab yuborilmaydi (shaxsiy ma'lumotlarni minimallashtirish).
 */
export function buildAiContext(crm, agent) {
  const { apartments, clients, payments, debtors } = crm;
  const sold = apartments.filter((a) => a.status === "sold");
  const totals = periodTotals(payments);
  const contractValue = clients.reduce((s, c) => s + c.totalPrice, 0);
  const collected = clients.reduce((s, c) => s + c.paid, 0);

  const byRooms = {};
  for (const a of apartments) {
    const k = `${a.rooms}-xonali`;
    byRooms[k] ??= { jami: 0, sotilgan: 0 };
    byRooms[k].jami++;
    if (a.status === "sold") byRooms[k].sotilgan++;
  }

  const base = {
    bugun: new Date().toISOString().slice(0, 10),
    obyekt: { qavatlar: 7, podyezdlar: 2, jami_xonadon: apartments.length },
    sotuv: {
      sotilgan: sold.length,
      bosh: apartments.length - sold.length,
      xonalar_boyicha: byRooms,
      oylik_sotuvlar: salesByMonth(clients),
      ortacha_m2_narx: Math.round(
        clients.reduce((s, c) => s + (c.apartment?.area ? c.totalPrice / c.apartment.area : 0), 0) / (clients.length || 1),
      ),
    },
    moliya: {
      shartnomalar_umumiy_qiymati: contractValue,
      jami_yigilgan: collected,
      qolgan_tolov: contractValue - collected,
      tushum: {
        shu_hafta: totals.week.value, otgan_hafta: totals.week.prev,
        shu_oy: totals.month.value, otgan_oy: totals.month.prev,
        shu_yil: totals.year.value, otgan_yil: totals.year.prev,
      },
      oylik_tushum_12_oy: groupRevenue(payments, "month", 12).map(({ key, total, humo, uzcard, bank, cash }) => ({ oy: key, jami: total, humo, uzcard, bank, naqd: cash })),
      haftalik_tushum_8_hafta: groupRevenue(payments, "week", 8).map(({ key, total }) => ({ hafta: key, jami: total })),
      tolov_turlari: revenueByType(payments).map(({ name, value }) => ({ turi: name, summa: value })),
      kutilayotgan_oylik_tushum: clients.filter((c) => c.remaining > 0).reduce((s, c) => s + c.monthlyPayment, 0),
    },
    qarzdorlik: {
      qarzdorlar_soni: debtors.length,
      jami_qarz: debtors.reduce((s, c) => s + c.debt, 0),
      grafik_kiritilmagan_mijozlar: clients.filter((c) => !c.hasSchedule && c.remaining > 0).length,
      tolov_toxtagan_grafiksiz: clients.filter((c) => c.stale).slice(0, 40).map((c) => ({
        fio: c.fullName, xonadon: c.apartmentId, shartnoma: c.contractNumber, qoldiq: c.remaining,
        oxirgi_tolov: c.lastPaymentDate, otgan_kun: c.daysSinceLastPayment,
      })),
      qarzdorlar: debtors.slice(0, 40).map((c) => ({
        fio: c.fullName,
        xonadon: c.apartmentId,
        shartnoma: c.contractNumber,
        shartnoma_sanasi: c.contractDate,
        qarz: c.debt,
        kechikish_kun: c.overdueDays,
        oxirgi_tolov: c.lastPaymentDate,
        ...(agent === "lawyer" ? { umumiy_narx: c.totalPrice, tolangan: c.paid, telefon: c.phone } : {}),
      })),
    },
  };
  return base;
}
