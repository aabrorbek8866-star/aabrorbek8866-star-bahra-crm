export const fmtMoney = (n, withUnit = true) => {
  const v = Math.round(Number(n) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return withUnit ? `${v} so'm` : v;
};

/** Grafiklar uchun qisqa ko'rinish: 1.2 mlrd, 350 mln */
export const fmtShort = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)} mlrd`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(0)} mln`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)} ming`;
  return String(v);
};

export const fmtDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
};

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const MONTHS_UZ = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
