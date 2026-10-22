import * as XLSX from "xlsx";
import { BUILDING, locateApartment } from "../../shared/building.js";

// Excel ustun nomlarini moslashuvchan aniqlash: bir nechta yozilish variantlari qabul qilinadi.
const CLIENT_COLUMNS = {
  apartmentId:       ["xonadon", "xonadon raqami", "xonadon №", "kv", "kvartira", "№"],
  entrance:          ["podyezd", "podezd", "pod'ezd"],
  floor:             ["qavat", "etaj"],
  area:              ["maydon", "kvadrat", "kv.m", "m2", "m²", "maydoni"],
  rooms:             ["xonalar", "xonalar soni", "xona"],
  status:            ["holati", "holat", "status"],
  fullName:          ["fio", "f.i.o", "f.i.sh", "mijoz", "ism familiya"],
  passport:          ["pasport", "passport", "pasport malumotlari"],
  phone:             ["telefon", "tel", "telefon raqami"],
  contractNumber:    ["shartnoma raqami", "shartnoma №", "shartnoma"],
  contractDate:      ["shartnoma sanasi", "sana"],
  totalPrice:        ["umumiy narx", "narxi", "shartnoma summasi", "umumiy summa"],
  downPayment:       ["boshlangich tolov", "boshlang'ich to'lov", "oldindan tolov"],
  monthlyPayment:    ["oylik tolov", "oylik to'lov", "har oylik tolov"],
  installmentMonths: ["muddat", "muddat (oy)", "oylar soni", "bolib tolash muddati"],
  lastPaymentDate:   ["oxirgi tolov sanasi", "oxirgi to'lov sanasi", "oxirgi tolov"],
};

const PAYMENT_COLUMNS = {
  ref:     ["shartnoma raqami", "xonadon", "xonadon raqami", "mijoz id"],
  date:    ["sana", "tolov sanasi", "to'lov sanasi"],
  type:    ["turi", "tolov turi", "to'lov turi"],
  amount:  ["summa", "tolov summasi", "to'lov summasi"],
  comment: ["izoh", "comment", "izohlar"],
};

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[ʻʼ'`‘’]/g, "")
    .replace(/[_\s]+/g, " ")
    .trim();

function mapHeaders(headerRow, spec) {
  const result = {};
  headerRow.forEach((h, idx) => {
    const n = norm(h);
    for (const [field, aliases] of Object.entries(spec)) {
      if (result[field] === undefined && aliases.some((a) => norm(a) === n)) result[field] = idx;
    }
  });
  // Ikkinchi o'tish: qisman moslik ("Shartnoma raqami (№)" kabi)
  headerRow.forEach((h, idx) => {
    const n = norm(h);
    for (const [field, aliases] of Object.entries(spec)) {
      if (result[field] === undefined && aliases.some((a) => n.startsWith(norm(a)))) result[field] = idx;
    }
  });
  return result;
}

const toNumber = (v) => {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(/,/g, "."));
  return Number.isFinite(n) ? n : 0;
};

/** Excel sana (seriya raqam), Date, "dd.mm.yyyy" yoki "yyyy-mm-dd" → "yyyy-mm-dd" */
export const toIsoDate = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

const parseType = (v) => {
  const s = norm(v);
  if (s.includes("humo")) return "humo";
  if (s.includes("uzcard") || s.includes("uzkard")) return "uzcard";
  if (s.includes("bank") || s.includes("otkazma")) return "bank";
  if (s.includes("naqd") || s.includes("kassa") || s.includes("office") || s.includes("ofis")) return "cash";
  return null;
};

const sheetRows = (ws) => XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

/** Sarlavha qatorini topish (birinchi 10 qatordan eng ko'p moslik bergani). */
function findHeader(rows, spec) {
  let best = { idx: 0, map: {}, score: 0 };
  rows.slice(0, 10).forEach((row, idx) => {
    const map = mapHeaders(row, spec);
    const score = Object.keys(map).length;
    if (score > best.score) best = { idx, map, score };
  });
  return best;
}

/**
 * Excel faylni o'qib, xonadon/mijoz/to'lov ob'ektlariga aylantiradi.
 * 1-varaq (yoki "Mijozlar"): har bir qator — bitta xonadon (56 ta).
 * Ixtiyoriy "To'lovlar" varag'i: to'lov tarixi.
 * @returns {Promise<{ apartments, clients, payments, errors: string[], warnings: string[] }>}
 */
export async function parseCrmWorkbook(file) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const errors = [];
  const warnings = [];

  const clientSheetName =
    wb.SheetNames.find((n) => norm(n).includes("mijoz")) ?? wb.SheetNames[0];
  const paymentSheetName = wb.SheetNames.find((n) => norm(n).includes("tolov"));

  const rows = sheetRows(wb.Sheets[clientSheetName]);
  const { idx: headerIdx, map } = findHeader(rows, CLIENT_COLUMNS);
  if (map.apartmentId === undefined) {
    errors.push(`"${clientSheetName}" varag'ida "Xonadon raqami" ustuni topilmadi.`);
    return { apartments: [], clients: [], payments: [], errors, warnings };
  }

  const get = (row, f) => (map[f] === undefined ? "" : row[map[f]]);
  const apartments = new Map();
  const clients = [];

  rows.slice(headerIdx + 1).forEach((row, i) => {
    const line = headerIdx + i + 2;
    const num = Math.round(toNumber(get(row, "apartmentId")));
    if (!num) return; // bo'sh qator
    if (num < 1 || num > BUILDING.total) {
      errors.push(`${line}-qator: xonadon raqami ${num} — 1..${BUILDING.total} oralig'ida bo'lishi kerak.`);
      return;
    }
    if (apartments.has(num)) warnings.push(`${line}-qator: ${num}-xonadon takrorlangan, oxirgisi olindi.`);

    const loc = locateApartment(num);
    const fullName = String(get(row, "fullName")).trim();
    const statusRaw = norm(get(row, "status"));
    const sold = fullName ? true : statusRaw.includes("sotil");

    const apt = {
      id: num,
      entrance: Math.round(toNumber(get(row, "entrance"))) || loc.entrance,
      floor: Math.round(toNumber(get(row, "floor"))) || loc.floor,
      area: toNumber(get(row, "area")),
      rooms: Math.round(toNumber(get(row, "rooms"))),
      status: sold ? "sold" : "free",
      clientId: null,
    };

    if (sold && fullName) {
      const contractDate = toIsoDate(get(row, "contractDate"));
      const totalPrice = toNumber(get(row, "totalPrice"));
      const downPayment = toNumber(get(row, "downPayment"));
      const installmentMonths = Math.round(toNumber(get(row, "installmentMonths"))) || 24;
      const monthlyPayment =
        toNumber(get(row, "monthlyPayment")) ||
        Math.round(Math.max(0, totalPrice - downPayment) / installmentMonths);

      if (!contractDate) warnings.push(`${line}-qator (${fullName}): shartnoma sanasi yo'q — bugungi sana qo'yildi.`);
      if (!totalPrice) warnings.push(`${line}-qator (${fullName}): umumiy narx ko'rsatilmagan — qarzdorlik hisoblanmaydi.`);

      const client = {
        id: num, // vaqtinchalik — bazada haqiqiy id beriladi
        fullName,
        passport: String(get(row, "passport")).trim(),
        phone: String(get(row, "phone")).trim(),
        contractNumber: String(get(row, "contractNumber")).trim() || `BB-${num}`,
        contractDate: contractDate ?? new Date().toISOString().slice(0, 10),
        lastPaymentDate: toIsoDate(get(row, "lastPaymentDate")),
        contractPdfUrl: null,
        contractPdfName: null,
        apartmentId: num,
        totalPrice,
        downPayment,
        monthlyPayment,
        installmentMonths,
      };
      apt.clientId = client.id;
      clients.push(client);
    }
    apartments.set(num, apt);
  });

  // Excelda yo'q xonadonlarni "Bo'sh" sifatida to'ldirish — har doim 56 ta bo'ladi
  for (let n = 1; n <= BUILDING.total; n++) {
    if (!apartments.has(n)) {
      apartments.set(n, { id: n, ...locateApartment(n), area: 0, rooms: 0, status: "free", clientId: null });
    }
  }
  if (apartments.size > 0 && rows.length - headerIdx - 1 < BUILDING.total) {
    warnings.push(`Excelda ${BUILDING.total} tadan kam xonadon bor — yetishmaganlari "Bo'sh" deb qo'shildi.`);
  }

  const payments = paymentSheetName
    ? parsePaymentsSheet(wb.Sheets[paymentSheetName], clients, errors, warnings)
    : [];

  return {
    apartments: [...apartments.values()].sort((a, b) => a.id - b.id),
    clients,
    payments,
    errors,
    warnings,
  };
}

function parsePaymentsSheet(ws, clients, errors, warnings) {
  const rows = sheetRows(ws);
  const { idx: headerIdx, map } = findHeader(rows, PAYMENT_COLUMNS);
  if (map.ref === undefined || map.amount === undefined) {
    warnings.push(`"To'lovlar" varag'ida "Shartnoma raqami/Xonadon" yoki "Summa" ustuni topilmadi — to'lovlar o'tkazib yuborildi.`);
    return [];
  }
  const byContract = new Map(clients.map((c) => [norm(c.contractNumber), c]));
  const byApartment = new Map(clients.map((c) => [String(c.apartmentId), c]));
  const payments = [];

  rows.slice(headerIdx + 1).forEach((row, i) => {
    const line = headerIdx + i + 2;
    const ref = row[map.ref];
    if (ref === "" || ref === undefined) return;
    const client = byContract.get(norm(ref)) ?? byApartment.get(String(Math.round(toNumber(ref))));
    const amount = toNumber(row[map.amount]);
    const date = toIsoDate(row[map.date]);
    const type = parseType(row[map.type]);

    if (!client) return void errors.push(`To'lovlar, ${line}-qator: "${ref}" bo'yicha mijoz topilmadi.`);
    if (!amount || !date) return void errors.push(`To'lovlar, ${line}-qator: sana yoki summa noto'g'ri.`);
    if (!type) warnings.push(`To'lovlar, ${line}-qator: to'lov turi aniqlanmadi — "Ofis (naqd)" qo'yildi.`);

    payments.push({
      apartmentId: client.apartmentId,
      date,
      type: type ?? "cash",
      amount,
      comment: String(map.comment === undefined ? "" : row[map.comment]).trim() || "Excel'dan import qilindi",
    });
  });
  return payments;
}

/** Bo'sh shablon fayl — mijozlar Excelni qanday tayyorlashini bilishi uchun. */
export function downloadTemplate() {
  const header = [
    "Xonadon raqami", "Podyezd", "Qavat", "Maydon (m²)", "Xonalar soni", "Holati", "F.I.O", "Pasport",
    "Telefon", "Shartnoma raqami", "Shartnoma sanasi", "Umumiy narx", "Boshlang'ich to'lov",
    "Oylik to'lov", "Muddat (oy)", "Oxirgi to'lov sanasi",
  ];
  const rows = Array.from({ length: BUILDING.total }, (_, i) => {
    const { entrance, floor } = locateApartment(i + 1);
    return [i + 1, entrance, floor, "", "", "Bo'sh", "", "", "", "", "", "", "", "", "", ""];
  });
  rows[0] = [1, 1, 1, 64.5, 2, "Sotilgan", "Abdullayev Jasur Akmalovich", "AB 1234567", "+998 90 123-45-67",
    "BB-2024/001", "15.01.2024", 450000000, 150000000, 12500000, 24, "15.10.2026"];

  const paymentsHeader = ["Shartnoma raqami", "Sana", "Turi", "Summa", "Izoh"];
  const paymentsRows = [
    ["BB-2024/001", "15.01.2024", "Bank o'tkazmasi", 150000000, "Boshlang'ich to'lov, to'lov topshiriqnomasi №112"],
    ["BB-2024/001", "15.02.2024", "Humo terminal", 12500000, "Fevral oyi uchun"],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), "Mijozlar");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([paymentsHeader, ...paymentsRows]), "To'lovlar");
  XLSX.writeFile(wb, "Bahra_Building_shablon.xlsx");
}

/** Joriy bazani Excelga eksport qilish (zaxira nusxa / hisobot). */
export function exportToExcel({ apartments, clients, payments }) {
  const byId = new Map(clients.map((c) => [c.id, c]));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      apartments.map((a) => {
        const c = byId.get(a.clientId);
        return {
          "Xonadon raqami": a.id, Podyezd: a.entrance, Qavat: a.floor, "Maydon (m²)": a.area,
          "Xonalar soni": a.rooms, Holati: a.status === "sold" ? "Sotilgan" : "Bo'sh",
          "F.I.O": c?.fullName ?? "", Pasport: c?.passport ?? "", Telefon: c?.phone ?? "",
          "Shartnoma raqami": c?.contractNumber ?? "", "Shartnoma sanasi": c?.contractDate ?? "",
          "Umumiy narx": c?.totalPrice ?? "", "Boshlang'ich to'lov": c?.downPayment ?? "",
          "Oylik to'lov": c?.monthlyPayment ?? "", "Muddat (oy)": c?.installmentMonths ?? "",
        };
      }),
    ),
    "Mijozlar",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      payments.map((p) => ({
        "Shartnoma raqami": byId.get(p.clientId)?.contractNumber ?? p.clientId,
        Sana: p.date, Turi: p.type, Summa: p.amount, Izoh: p.comment,
      })),
    ),
    "To'lovlar",
  );
  XLSX.writeFile(wb, `Bahra_CRM_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
