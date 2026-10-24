import * as XLSX from "xlsx";
import { BUILDING, locateApartment } from "../../shared/building.js";
import { COMPANY } from "../../shared/company.js";
import { isRealIsoDate } from "../../shared/date.js";

/*
 * Excel formati — kompaniyaning "C-blok" fayli asosida:
 *   "umumiy" varag'i  — 56 xonadon: Etaj, Podez, Xonadon raqami, Maydoni, Umumiy/Yashash maydoni,
 *                       Shartnoma raqami/sanasi/summasi, Ism Familya (+ ixtiyoriy qo'shimcha ustunlar)
 *   "N-xonadon" varaqlari — har xonadonning to'lovlari: Sana | Officega to'lov | Terminal Humo |
 *                       Terminal uzcard | Bank | Shartnoma summasi | Izoh
 * Bitta mijozning to'lov jadvali (to'lov grafigi) ham xuddi shu "N-xonadon" ko'rinishida.
 */

// ---------- Umumiy yordamchilar ----------

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[ʻʼ'`‘’]/g, "")
    .replace(/[_\s]+/g, " ")
    .trim();

/** "77,8 м2" → 77.8 · "233 400 000" → 233400000 · 165000000 → 165000000 */
export const toNumber = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").replace(/(\d)[\s ]+(?=\d{3}\b)/g, "$1");
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(",", ".")) : 0;
};

const pad = (n) => String(n).padStart(2, "0");

/**
 * Har xil yozilgan sanalarni "yyyy-mm-dd" ga aylantirish:
 * Excel sana (seriya raqam), "29.08.2020", "26.10. 2020", "02.06 2023", "06,08,2026", "2020-08-29".
 */
export const toIsoDate = (v) => {
  const iso = parseDateLoose(v);
  return iso && isRealIsoDate(iso) ? iso : null; // 31.11.2020, 30.02.2021 kabi sanalar — noto'g'ri
};

function parseDateLoose(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d && d.y > 1990 ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\s*[.,/-]\s*(\d{1,2})\s*[.,/\-\s]\s*(\d{4})/);
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : null;
}

// JSHSHIR 14 xonali — Excel uni katta son deb o'qib qolsa ham raqamlari saqlanadi
const digitsOnly = (v) => (typeof v === "number" ? v.toFixed(0) : String(v ?? "")).replace(/\D/g, "");

const fmtDmy = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const todayIso = () => new Date().toISOString().slice(0, 10);

const sheetRows = (ws) => XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

/** Sarlavha qatoridagi ustunlarni aniqlash: avval to'liq moslik, keyin boshlanishi bo'yicha. */
function mapHeaders(headerRow, spec) {
  const result = {};
  const used = new Set();
  const pass = (match) =>
    headerRow.forEach((h, idx) => {
      const n = norm(h);
      if (!n || used.has(idx)) return;
      for (const [field, aliases] of Object.entries(spec)) {
        if (result[field] === undefined && aliases.some((a) => match(n, norm(a)))) {
          result[field] = idx;
          used.add(idx);
          return;
        }
      }
    });
  pass((n, a) => n === a);
  pass((n, a) => n.startsWith(a));
  return result;
}

function findHeader(rows, spec, required) {
  let best = { idx: -1, map: {}, score: 0 };
  rows.slice(0, 12).forEach((row, idx) => {
    const map = mapHeaders(row, spec);
    const score = Object.keys(map).length;
    if (required.every((f) => map[f] !== undefined) && score > best.score) best = { idx, map, score };
  });
  return best;
}

// ---------- "umumiy" varag'i ----------

const MAIN_COLUMNS = {
  apartmentId:       ["xonadon raqami", "xonadon raqami tartib boyicha", "xonadon", "xonadon №", "kvartira", "№"],
  floor:             ["etaj", "qavat"],
  entrance:          ["podez", "podyezd", "podezd"],
  totalArea:         ["umumiy maydoni", "umumiy maydon"],
  livingArea:        ["yashash maydoni", "yashash maydon"],
  area:              ["maydoni (м.2)", "maydoni (m.2)", "maydoni", "maydon", "maydon (m²)", "maydon (m2)"],
  rooms:             ["xonalar soni", "xonalar", "xona"],
  status:            ["holati", "holat", "status"],
  contractNumber:    ["shartnoma raqami", "shartnoma №"],
  contractDate:      ["shartnoma sanasi"],
  totalPrice:        ["shartnoma summasi", "sahrtnoma summasi", "umumiy narx", "narxi", "umumiy summa"],
  fullName:          ["ism familya", "ism familiya", "f.i.o", "fio", "f.i.sh", "mijoz"],
  phone:             ["telefon", "telefon raqami", "tel"],
  passport:          ["pasport", "passport"],
  downPayment:       ["boshlangich tolov", "oldindan tolov"],
  monthlyPayment:    ["oylik tolov", "har oylik tolov"],
  installmentMonths: ["muddat (oy)", "muddat", "oylar soni"],
  address:           ["manzil", "manzili", "yashash manzili"],
  passportIssuedBy:  ["pasport kim tomonidan berilgan", "kim tomonidan berilgan", "pasport bergan organ"],
  passportIssuedAt:  ["pasport berilgan sana", "berilgan sana"],
  jshshir:           ["jshshir", "jshir", "jshshr", "pinfl", "жшшир", "jshshir (pinfl)"],
};

// ---------- To'lovlar jadvali ("N-xonadon" / to'lov grafigi) ----------

const GRID_COLUMNS = {
  date:   ["sana", "tolov sanasi"],
  cash:   ["officega tolov", "ofisga tolov", "office", "ofis", "naqd", "kassa"],
  humo:   ["terminal humo", "humo"],
  uzcard: ["terminal uzcard", "uzcard", "uzkard"],
  bank:   ["bank", "bank otkazmasi", "bank orqali"],
  total:  ["shartnoma summasi", "sahrtnoma summasi"],
  comment: ["izoh", "izohlar", "comment"],
};

const GRID_TYPES = [
  ["cash", "Officega to'lov"],
  ["humo", "Terminal Humo"],
  ["uzcard", "Terminal uzcard"],
  ["bank", "Bank"],
];

/**
 * Bitta to'lovlar jadvalini o'qish.
 * Bir qatorda bir nechta ustun to'ldirilgan bo'lsa (masalan, ofis + uzcard), har biri alohida to'lov bo'ladi.
 * @returns {{ title, totalPrice, payments: {date,type,amount,comment}[], warnings: string[] } | null}
 */
export function parsePaymentGrid(ws, label = "") {
  const rows = sheetRows(ws);
  const { idx, map } = findHeader(rows, GRID_COLUMNS, ["date"]);
  if (idx < 0 || !GRID_TYPES.some(([t]) => map[t] !== undefined)) return null;

  const title = rows
    .slice(0, idx)
    .flat()
    .map((v) => String(v).trim())
    .find((v) => v && Number.isNaN(Number(v)));
  const payments = [];
  const warnings = [];
  let totalPrice = 0;
  const today = todayIso();

  // "jami:" qatori va undan oldingi =SUM(...) qatori to'lov emas
  const body = rows.slice(idx + 1);
  const jamiAt = body.findIndex((row) => row.some((v) => /^(jami|qarzdorligi)/.test(norm(v))));

  body.forEach((row, i) => {
    const line = idx + i + 2;
    if (!totalPrice && map.total !== undefined) totalPrice = toNumber(row[map.total]);
    const hasAmount = GRID_TYPES.some(([t]) => map[t] !== undefined && toNumber(row[map[t]]) > 0);
    if (!hasAmount) return; // bo'sh qator
    if (jamiAt >= 0 && i >= jamiAt - 1 && String(row[map.date]).trim() === "") return; // jami (SUM) qatori
    const date = toIsoDate(row[map.date]);
    if (!date) return void warnings.push(`${label}${line}-qator: sana noto'g'ri ("${row[map.date]}") — o'tkazib yuborildi`);
    if (date > today) return void warnings.push(`${label}${line}-qator: sana kelajakda (${fmtDmy(date)}) — o'tkazib yuborildi`);
    const comment = map.comment !== undefined ? String(row[map.comment]).trim() : "";
    for (const [type, colLabel] of GRID_TYPES) {
      if (map[type] === undefined) continue;
      const amount = Math.round(toNumber(row[map[type]]));
      if (amount > 0) payments.push({ date, type, amount, comment: comment || `${colLabel} (Excel'dan)` });
    }
  });
  return { title, totalPrice, payments, warnings };
}

/** Mijoz kabinetidan yuklanadigan bitta to'lov jadvali fayli. */
export async function parsePaymentScheduleFile(file) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  for (const name of wb.SheetNames) {
    const grid = parsePaymentGrid(wb.Sheets[name]);
    if (grid) return grid;
  }
  throw new Error("Faylda to'lovlar jadvali topilmadi: \"Sana\" va \"Officega to'lov / Terminal Humo / Terminal uzcard / Bank\" ustunlari bo'lishi kerak.");
}

// ---------- To'liq fayl importi ----------

/**
 * C-blok faylini o'qish: "umumiy" + "N-xonadon" varaqlari.
 * @returns {Promise<{ apartments, clients, payments, errors: string[], warnings: string[] }>}
 */
export async function parseCrmWorkbook(file) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const errors = [];
  const warnings = [];
  const today = todayIso();

  // Asosiy varaq: "umumiy" yoki xonadon raqami ustuni bor birinchi varaq
  const candidates = [...wb.SheetNames].sort((a, b) => Number(norm(b).includes("umumiy")) - Number(norm(a).includes("umumiy")));
  let mainName = null;
  let header = null;
  for (const name of candidates) {
    const h = findHeader(sheetRows(wb.Sheets[name]), MAIN_COLUMNS, ["apartmentId"]);
    if (h.idx >= 0) { mainName = name; header = h; break; }
  }
  if (!mainName) {
    errors.push(`Asosiy varaq topilmadi: "Xonadon raqami" ustuni bo'lgan varaq ("umumiy") kerak.`);
    return { apartments: [], clients: [], payments: [], errors, warnings };
  }

  const rows = sheetRows(wb.Sheets[mainName]);
  const { idx: headerIdx, map } = header;
  const get = (row, f) => (map[f] === undefined ? "" : row[map[f]]);
  const apartments = new Map();
  const clients = [];
  const contractCount = new Map();

  rows.slice(headerIdx + 1).forEach((row, i) => {
    const line = headerIdx + i + 2;
    const num = Math.round(toNumber(get(row, "apartmentId")));
    if (!num) return;
    if (num < 1 || num > BUILDING.total) return void errors.push(`${line}-qator: xonadon raqami ${num} — 1..${BUILDING.total} oralig'ida bo'lishi kerak.`);
    if (apartments.has(num)) warnings.push(`${line}-qator: ${num}-xonadon takrorlangan, oxirgisi olindi.`);

    const loc = locateApartment(num);
    const nameRaw = String(get(row, "fullName")).trim();
    const unsold = norm(nameRaw).startsWith("sotilma") || norm(get(row, "status")).startsWith("bosh");
    const contractNumber = String(get(row, "contractNumber")).trim();
    const totalPrice = Math.round(toNumber(get(row, "totalPrice")));
    const sold = !unsold && Boolean(nameRaw || contractNumber || totalPrice);

    const apt = {
      id: num,
      entrance: loc.entrance,
      floor: loc.floor,
      area: toNumber(get(row, "area")),
      totalArea: toNumber(get(row, "totalArea")),
      livingArea: toNumber(get(row, "livingArea")),
      rooms: Math.round(toNumber(get(row, "rooms"))),
      status: sold ? "sold" : "free",
    };
    apartments.set(num, apt);
    if (!sold) return;

    let contractDate = toIsoDate(get(row, "contractDate"));
    if (!contractDate) {
      warnings.push(`№${num}: shartnoma sanasi yo'q yoki noto'g'ri ("${get(row, "contractDate")}") — bugungi sana qo'yildi, kabinetda tuzating.`);
      contractDate = today;
    } else if (contractDate > today) {
      warnings.push(`№${num}: shartnoma sanasi kelajakda — ${fmtDmy(contractDate)}. Xato bo'lsa, kabinetda tuzating.`);
    }
    const fullName = nameRaw || `Ism kiritilmagan (№${num})`;
    if (!nameRaw) warnings.push(`№${num}: mijoz ismi yozilmagan — "${fullName}" deb saqlanadi, kabinetda tuzating.`);
    if (!totalPrice) warnings.push(`№${num}: shartnoma summasi yo'q.`);
    const cn = contractNumber || `№${num}`;
    contractCount.set(cn, [...(contractCount.get(cn) ?? []), num]);

    clients.push({
      id: num, // vaqtinchalik — bazada haqiqiy id beriladi
      apartmentId: num,
      fullName,
      phone: String(get(row, "phone")).trim(),
      passport: String(get(row, "passport")).trim(),
      contractNumber: cn,
      contractDate,
      totalPrice,
      downPayment: Math.round(toNumber(get(row, "downPayment"))),
      monthlyPayment: Math.round(toNumber(get(row, "monthlyPayment"))),
      installmentMonths: Math.round(toNumber(get(row, "installmentMonths"))),
      address: String(get(row, "address")).trim(),
      passportIssuedBy: String(get(row, "passportIssuedBy")).trim(),
      passportIssuedAt: toIsoDate(get(row, "passportIssuedAt")),
      jshshir: digitsOnly(get(row, "jshshir")),
    });
    const jsh = digitsOnly(get(row, "jshshir"));
    if (jsh && jsh.length !== 14) warnings.push(`№${num}: JSHSHIR ${jsh.length} xonali ("${get(row, "jshshir")}") — 14 xonali bo'lishi kerak, olinmadi.`);
  });

  for (const [cn, nums] of contractCount) {
    if (nums.length > 1) warnings.push(`Shartnoma raqami "${cn}" bir nechta xonadonda: №${nums.join(", №")}.`);
  }
  for (let n = 1; n <= BUILDING.total; n++) {
    if (!apartments.has(n)) apartments.set(n, { id: n, ...locateApartment(n), area: 0, totalArea: 0, livingArea: 0, rooms: 0, status: "free" });
  }

  // To'lovlar: har bir "N-xonadon" varag'i
  const clientByApt = new Map(clients.map((c) => [c.apartmentId, c]));
  const payments = [];
  for (const name of wb.SheetNames) {
    const m = norm(name).match(/^(\d+)\s*-?\s*xonadon/);
    if (!m) continue;
    const num = Number(m[1]);
    const grid = parsePaymentGrid(wb.Sheets[name], `"${name.trim()}" varag'i, `);
    if (!grid) continue;
    warnings.push(...grid.warnings);
    if (!grid.payments.length) continue;
    const client = clientByApt.get(num);
    if (!client) {
      warnings.push(`"${name.trim()}": ${grid.payments.length} ta to'lov bor, lekin "umumiy" da bu xonadon sotilmagan — to'lovlar olinmadi.`);
      continue;
    }
    if (!client.totalPrice && grid.totalPrice) client.totalPrice = Math.round(grid.totalPrice);
    payments.push(...grid.payments.map((p) => ({ ...p, apartmentId: num })));
  }

  return { apartments: [...apartments.values()].sort((a, b) => a.id - b.id), clients, payments, errors, warnings };
}

// ---------- Shablon va eksport (xuddi shu formatda) ----------

const MAIN_HEADER = [
  "Etaj", "Podez", "Xonadon raqami tartib bo'yicha", "Maydoni (м.2)", "Umumiy maydoni", "Yashash maydoni",
  "Shartnoma raqami", "Shartnoma sanasi", "Shartnoma summasi", "Ism Familya",
  // Qo'shimcha (ixtiyoriy) ustunlar — qarz muddatini kuzatish va SMS uchun
  "Xonalar soni", "Telefon", "Pasport", "Boshlang'ich to'lov", "Oylik to'lov", "Muddat (oy)",
  "Manzil", "Pasport kim tomonidan berilgan", "Pasport berilgan sana", "JSHSHIR", "Notarius",
];

/** Faylingizdagi tartib: har qavatda avval 1-podyezd (1,2,3,4), keyin 2-podyezd (29,30,31,32). */
function mainSheetOrder() {
  const order = [];
  for (let floor = 1; floor <= BUILDING.floors; floor++) {
    for (let entrance = 1; entrance <= BUILDING.entrances; entrance++) {
      const first = (entrance - 1) * BUILDING.floors * BUILDING.perFloor + (floor - 1) * BUILDING.perFloor + 1;
      for (let k = 0; k < BUILDING.perFloor; k++) order.push({ id: first + k, floor, entrance, first: k === 0 });
    }
  }
  return order;
}

function buildMainSheet(apartments, clientByApt) {
  const aptById = new Map(apartments.map((a) => [a.id, a]));
  const aoa = [MAIN_HEADER];
  const merges = [];
  mainSheetOrder().forEach(({ id, floor, entrance, first }) => {
    const a = aptById.get(id) ?? {};
    const c = clientByApt.get(id);
    const r = aoa.length;
    if (first && entrance === 1) merges.push({ s: { r, c: 0 }, e: { r: r + BUILDING.perFloor * BUILDING.entrances - 1, c: 0 } });
    if (first) merges.push({ s: { r, c: 1 }, e: { r: r + BUILDING.perFloor - 1, c: 1 } });
    aoa.push([
      first && entrance === 1 ? `${floor}-Etaj` : "",
      first ? entrance : "",
      id,
      a.area ? `${String(a.area).replace(".", ",")} м2` : "",
      a.totalArea || "",
      a.livingArea || "",
      c?.contractNumber ?? "",
      c ? fmtDmy(c.contractDate) : "",
      c?.totalPrice || "",
      c ? c.fullName : "sotilmagan",
      a.rooms || "",
      c?.phone ?? "",
      c?.passport ?? "",
      c?.downPayment || "",
      c?.monthlyPayment || "",
      c?.installmentMonths || "",
      c?.address ?? "",
      c?.passportIssuedBy ?? "",
      c ? fmtDmy(c.passportIssuedAt) : "",
      c?.jshshir ?? "",
      c ? (c.notarized ? `ha, ${fmtDmy(c.notarizedAt)}` : "yo'q") : "",
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;
  ws["!cols"] = [8, 7, 12, 12, 10, 10, 11, 12, 14, 34, 8, 18, 13, 14, 12, 9, 34, 30, 12, 16, 14].map((wch) => ({ wch }));
  return ws;
}

const GRID_HEADER = ["", "Sana", "Officega to'lov", "Terminal Humo", "Terminal uzcard", "Bank", "Shartnoma summasi", "Izoh"];
const TYPE_COL = { cash: 2, humo: 3, uzcard: 4, bank: 5 };

/** Bitta xonadon/mijozning to'lovlar jadvali — faylingizdagi "N-xonadon" varag'i ko'rinishida. */
function buildGridSheet(title, totalPrice, payments, minRows = 28) {
  const list = [...payments].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const aoa = [[title ?? ""], GRID_HEADER];
  const rowCount = Math.max(minRows, list.length + 5);
  for (let i = 0; i < rowCount; i++) {
    const p = list[i];
    const row = [i + 1, p ? fmtDmy(p.date) : "", "", "", "", "", i === 0 ? totalPrice || "" : "", p?.comment ?? ""];
    if (p) row[TYPE_COL[p.type]] = p.amount;
    aoa.push(row);
  }
  const first = 3; // Excel'dagi birinchi ma'lumot qatori
  const last = first + rowCount - 1;
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const sumRow = last + 1;
  ["C", "D", "E", "F"].forEach((col) => {
    ws[`${col}${sumRow}`] = { t: "n", f: `SUM(${col}${first}:${col}${last})` };
  });
  ws[`A${sumRow + 1}`] = { t: "s", v: "jami:" };
  ws[`B${sumRow + 1}`] = { t: "n", f: `C${sumRow}+D${sumRow}+E${sumRow}+F${sumRow}` };
  ws[`A${sumRow + 2}`] = { t: "s", v: "qarzdorligi" };
  ws[`B${sumRow + 2}`] = { t: "n", f: `G${first}-B${sumRow + 1}` };
  ws["!ref"] = `A1:H${sumRow + 2}`;
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
  ws["!cols"] = [5, 12, 15, 15, 15, 15, 17, 40].map((wch) => ({ wch }));
  return ws;
}

/**
 * C-blok ko'rinishidagi to'liq fayl.
 * withData=false — shablon: xonadonlar (maydonlar) to'ldirilgan, mijoz va to'lovlar bo'sh.
 */
export function downloadFullWorkbook({ apartments, clients, payments }, withData = true) {
  const clientByApt = new Map(withData ? clients.map((c) => [c.apartmentId, c]) : []);
  const paysByClient = new Map();
  if (withData) for (const p of payments) paysByClient.set(p.clientId, [...(paysByClient.get(p.clientId) ?? []), p]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildMainSheet(apartments, clientByApt), "umumiy");
  for (let n = 1; n <= BUILDING.total; n++) {
    const c = clientByApt.get(n);
    XLSX.utils.book_append_sheet(wb, buildGridSheet(c?.fullName ?? "", c?.totalPrice, c ? paysByClient.get(c.id) ?? [] : []), `${n}-xonadon`);
  }
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, withData ? `${COMPANY.brand}_C-blok_${date}.xlsx` : `${COMPANY.brand}_C-blok_shablon.xlsx`);
}

/** Bitta mijozning to'lovlar jadvali (to'lov grafigi). client bo'lmasa — bo'sh shablon. */
export function downloadPaymentSchedule(client, payments = []) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildGridSheet(client?.fullName ?? "", client?.totalPrice, payments, 40), "to'lov");
  XLSX.writeFile(wb, client ? `Tolovlar_${client.apartmentId}-xonadon.xlsx` : "Tolovlar_jadvali_shablon.xlsx");
}
