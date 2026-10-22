import { BUILDING, locateApartment } from "../../shared/building.js";

// Demo ma'lumotlar: Excel yuklanmaguncha tizimni ko'rsatish uchun. Deterministik (har safar bir xil).
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

const NAMES = [
  "Abdullayev Jasur Akmalovich", "Karimova Dilnoza Rustamovna", "Toshmatov Bekzod Olimovich",
  "Yusupova Madina Shavkatovna", "Rahimov Sardor Ilhomovich", "Ergasheva Nilufar Baxtiyorovna",
  "Qodirov Aziz Farhodovich", "Nazarova Gulnora Anvarovna", "Xolmatov Otabek Rustamovich",
  "Saidova Kamola Ulug'bekovna", "Mirzayev Doston Sobirovich", "Ismoilova Shahnoza Erkinovna",
  "Sharipov Ulug'bek Hamidovich", "Tursunova Malika Akramovna", "Normatov Javlon Shuhratovich",
  "Hasanova Zarina Botirovna", "Aliyev Sherzod Komilovich", "Ortiqova Feruza Alisherovna",
  "Jo'rayev Bobur Nodirovich", "Usmonova Sevara Dilshodovna", "Raxmatullayev Farrux Ibrohimovich",
  "Sultonova Laylo Mansurovna", "Ahmedov Elyor Zafarovich", "Qosimova Mohira Ravshanovna",
  "Valiyev Islom Muxtorovich", "Mamatqulova Dildora Abduvaliyevna", "Po'latov Akbar Sanjarovich",
  "Hamroyeva Nodira Fayzullayevna", "Ibragimov Rustam Tohirovich", "Xudoyberdiyeva Gulchehra Odilovna",
  "Boboyev Shoxrux Murodovich", "Sobirova Munisa Jamshidovna", "Davronov Asilbek Valijonovich",
  "Mahmudova Ozoda Qahramonovna", "Fayziyev Temur Abdurashidovich", "Rajabova Shahlo Ziyodovna",
  "Eshmatov Alisher Turgunovich", "Yo'ldosheva Barno Habibullayevna", "Nurmatov Diyor Baxodirovich",
  "Komilova Charos Ilyosovna", "Zokirov Mirjalol Saidovich", "Qurbonova Nargiza Mamurovna",
];
const TYPES = ["humo", "uzcard", "bank", "cash"];
const COMMENTS = {
  humo: ["Ofisdagi Humo terminal orqali oylik to'lov", "Humo karta, chek №"],
  uzcard: ["Uzcard terminal, oylik to'lov", "Uzcard orqali, mijoz o'zi keldi"],
  bank: ["Bank o'tkazmasi, to'lov topshiriqnomasi №", "Ipoteka banki orqali o'tkazma"],
  cash: ["Kassaga naqd topshirildi, kvitansiya №", "Naqd, qabul qildi: kassir"],
};

const iso = (d) => d.toISOString().slice(0, 10);
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

export function buildSeed() {
  const r = rng(20240115);
  const apartments = [];
  const clients = [];
  const payments = [];
  const today = new Date();
  let nameIdx = 0;

  for (let n = 1; n <= BUILDING.total; n++) {
    const { entrance, floor } = locateApartment(n);
    const pos = (n - 1) % 4;
    const rooms = [1, 2, 3, 2][pos] + (floor === 7 && pos === 2 ? 1 : 0);
    const area = Math.round((28 + rooms * 19 + r() * 6) * 10) / 10;
    const sold = nameIdx < NAMES.length && r() < 0.78;
    const apt = { id: n, entrance, floor, area, rooms, status: sold ? "sold" : "free", clientId: null };

    if (sold) {
      const id = `cl_${n}`;
      const pricePerM2 = 6_500_000 + Math.round(r() * 15) * 100_000;
      const totalPrice = Math.round((area * pricePerM2) / 1_000_000) * 1_000_000;
      const downPayment = Math.round((totalPrice * (0.25 + r() * 0.2)) / 1_000_000) * 1_000_000;
      const installmentMonths = [24, 36, 48][Math.floor(r() * 3)];
      const monthlyPayment = Math.round((totalPrice - downPayment) / installmentMonths / 10_000) * 10_000;
      const start = new Date(2024, Math.floor(r() * 20), 1 + Math.floor(r() * 27));
      if (start > today) start.setFullYear(today.getFullYear() - 1);

      clients.push({
        id, fullName: NAMES[nameIdx++],
        passport: `A${"BCDEFG"[Math.floor(r() * 6)]} ${String(Math.floor(1e6 + r() * 8.9e6))}`,
        phone: `+998 9${Math.floor(r() * 10)} ${String(100 + Math.floor(r() * 899))}-${String(10 + Math.floor(r() * 89))}-${String(10 + Math.floor(r() * 89))}`,
        contractNumber: `BB-${start.getFullYear()}/${String(n).padStart(3, "0")}`,
        contractDate: iso(start), lastPaymentDate: null,
        contractPdfUrl: null, contractPdfName: null,
        apartmentId: n, totalPrice, downPayment, monthlyPayment, installmentMonths,
      });
      apt.clientId = id;

      // Boshlang'ich to'lov + oylik to'lovlar; ~25% mijozlar intizomsiz (qarzdor bo'ladi)
      const discipline = r() < 0.25 ? 0.55 + r() * 0.3 : 0.97;
      const push = (date, amount, type) =>
        payments.push({
          id: `pay_${payments.length + 1}`, clientId: id, date: iso(date), type, amount,
          comment: `${COMMENTS[type][Math.floor(r() * 2)]}${type === "bank" || type === "cash" ? Math.floor(1000 + r() * 8999) : ""}`,
          createdAt: iso(date),
        });
      push(start, downPayment, r() < 0.6 ? "bank" : "cash");
      for (let m = 1; m <= installmentMonths; m++) {
        const due = addMonths(start, m);
        if (due > today) break;
        if (r() > discipline) continue;
        due.setDate(due.getDate() + Math.floor(r() * 6));
        if (due > today) break;
        push(due, monthlyPayment, TYPES[Math.floor(r() * 4)]);
      }
    }
    apartments.push(apt);
  }
  return { apartments, clients, payments };
}
