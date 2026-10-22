// Notarius hujjatlari uchun matnlar: lotin → kirill, sonni so'z bilan yozish, sana, "-га" qo'shimchasi.
// Hujjatlar (shartnoma, bayonnomalar, ma'lumotnomalar) o'zbek kirill yozuvida.

// ---------- Lotin → kirill ----------

// Ba'zi ismlarda lotin matn ichida kirill harflari aralash ("Аxmedova") — avval hammasini lotinga keltiramiz
const LOOKALIKE = { А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X", а: "a", е: "e", о: "o", р: "p", с: "c", х: "x", у: "y" };
const APOS = /[ʻʼ'`‘’]/g;

const PAIRS = [
  ["o'", "ў"], ["g'", "ғ"], ["sh", "ш"], ["ch", "ч"], ["yo", "ё"], ["yu", "ю"], ["ya", "я"], ["ye", "е"],
];
const SINGLE = {
  a: "а", b: "б", d: "д", e: "е", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к", l: "л", m: "м", n: "н",
  o: "о", p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у", v: "в", x: "х", y: "й", z: "з", c: "с", w: "в",
};

const isCyrillicWord = (w) => /[а-яёўқғҳ]/i.test(w) && !/[a-z]/i.test(w.replace(/[АВЕКМНОРСТХаеорсху]/g, ""));

function translitWord(word) {
  if (isCyrillicWord(word)) return word; // allaqachon kirillda
  const w = word.replace(/[АВЕКМНОРСТХаеорсху]/g, (ch) => LOOKALIKE[ch]).replace(APOS, "'");
  let out = "";
  let i = 0;
  while (i < w.length) {
    const two = w.slice(i, i + 2).toLowerCase();
    const pair = PAIRS.find(([lat]) => lat === two);
    let cyr, len;
    if (pair) {
      cyr = pair[1];
      len = 2;
    } else {
      const ch = w[i].toLowerCase();
      // So'z boshidagi "e" → "э"
      cyr = ch === "e" && (i === 0 || /[\s-]/.test(w[i - 1])) ? "э" : SINGLE[ch];
      len = 1;
      if (ch === "'") { cyr = "ъ"; } // tutuq belgisi (ma'lumot → маълумот)
      if (cyr === undefined) cyr = w[i];
    }
    const upper = w[i] !== w[i].toLowerCase();
    out += upper ? cyr[0].toUpperCase() + cyr.slice(1) : cyr;
    i += len;
  }
  return out;
}

export const toCyrillic = (text) =>
  String(text ?? "").trim().split(/(\s+|-)/).map((part) => (/^\s+$|^-$/.test(part) ? part : translitWord(part))).join("");

// ---------- Ism shakllari ----------

/** Rahmatova Xolida Samadjonovna → Рахматова Холида Самаджоновнага (jo'nalish kelishigi) */
export function dative(fullName) {
  const name = fullName.trim();
  const last = name.slice(-1).toLowerCase();
  if (last === "к") return `${name}ка`;
  if (last === "қ") return `${name}қа`;
  return `${name}га`;
}

/** Рахматова Холида ... → Х. Рахматова */
export function signatureName(fullName) {
  const [surname, first] = fullName.trim().split(/\s+/);
  return first ? `${first[0].toUpperCase()}. ${surname}` : surname ?? "";
}

// ---------- Son → so'z (kirill) ----------

const ONES = ["", "бир", "икки", "уч", "тўрт", "беш", "олти", "етти", "саккиз", "тўққиз"];
const TENS = ["", "ўн", "йигирма", "ўттиз", "қирқ", "эллик", "олтмиш", "етмиш", "саксон", "тўқсон"];
const SCALES = ["", "минг", "миллион", "миллиард", "триллион"];

function triad(n) {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  const words = [];
  if (h) words.push(h === 1 ? "юз" : `${ONES[h]} юз`); // 100 000 → "юз минг" (shablondagidek)
  if (t) words.push(TENS[t]);
  if (o) words.push(ONES[o]);
  return words.join(" ");
}

/** 282100000 → "Икки юз саксон икки миллион юз минг" */
export function numberToWords(value) {
  let n = Math.round(Number(value) || 0);
  if (n === 0) return "Нол";
  const parts = [];
  let scale = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(`${triad(chunk)}${SCALES[scale] ? ` ${SCALES[scale]}` : ""}`);
    n = Math.floor(n / 1000);
    scale++;
  }
  const text = parts.join(" ");
  return text[0].toUpperCase() + text.slice(1);
}

export const groupDigits = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** 282100000 → "282 100 000 (Икки юз саксон икки миллион юз минг)" */
// Raqamlar orasida uzilmaydigan bo'shliq — "351 640 000" qatorga bo'linib ketmasin
export const moneyWithWords = (n) => `${groupDigits(n).replace(/ /g, "\u00a0")} (${numberToWords(n)})`;

// ---------- Sana ----------

export const MONTHS_CYR = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

/** "2022-04-05" → "05.04.2022" */
export const dmy = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");

/** "40.87" → "40.87"; 73.7 → "73.70" (shartnomadagidek 2 xona) */
export const area = (v) => (Number(v) ? Number(v).toFixed(2) : "");

/** Pasport "AA 7795929" / "АА№7795929" → { seriya: "АА", raqam: "7795929" } */
export function splitPassport(passport) {
  const s = String(passport ?? "").replace(/№/g, " ").trim();
  const m = s.match(/^([A-Za-zА-Яа-яЎўҚқҒғҲҳ]{2})\s*,?\s*(\d{5,9})$/);
  if (!m) return { seriya: "", raqam: s };
  return { seriya: toCyrillic(m[1].toUpperCase()), raqam: m[2] };
}

/**
 * Shablon o'zgaruvchilari. Shartnoma raqami va sanasi — shartnomadan, qolgan sanalar — hujjat tayyorlangan kun.
 * @param {object} p — { fio (kirill), pasportSeriya, pasportRaqam, pasportKimTomonidan, pasportSanasi (yyyy-mm-dd),
 *                      manzil, xonadon, podyezd, qavat, xonalar, umumiyMaydon, yashashMaydon, narx,
 *                      shartnomaRaqami, shartnomaSanasi (yyyy-mm-dd), sana (yyyy-mm-dd) }
 */
export function notaryTemplateData(p) {
  const [y, m, d] = p.sana.split("-");
  return {
    fio: p.fio,
    fioGa: dative(p.fio),
    imzo: signatureName(p.fio),
    pasportSeriya: p.pasportSeriya,
    pasportRaqam: p.pasportRaqam,
    pasportKimTomonidan: p.pasportKimTomonidan,
    pasportSanasi: dmy(p.pasportSanasi),
    manzil: p.manzil,
    xonadon: String(p.xonadon),
    kadastr: String(p.xonadon).padStart(2, "0"),
    podyezd: String(p.podyezd),
    qavat: String(p.qavat),
    xonalar: String(p.xonalar),
    umumiyMaydon: area(p.umumiyMaydon),
    yashashMaydon: area(p.yashashMaydon),
    narxSoz: moneyWithWords(p.narx),
    shartnomaRaqami: p.shartnomaRaqami,
    shartnomaSanasi: dmy(p.shartnomaSanasi),
    kun: d,
    oy: MONTHS_CYR[Number(m) - 1],
    yil: y,
  };
}
