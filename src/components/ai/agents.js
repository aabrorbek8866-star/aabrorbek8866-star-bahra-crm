import { Briefcase, Calculator, Scale } from "lucide-react";

// Agentlarning frontend ko'rinishi. Tizim promptlari xavfsizlik uchun serverda: server/agents/prompts.js
export const AGENTS = {
  ceo: {
    id: "ceo",
    name: "AI CEO",
    role: "Strategik rahbar",
    icon: Briefcase,
    avatar: "bg-indigo-500/15 text-indigo-400",
    accent: "bg-indigo-600",
    ring: "ring-indigo-200",
    intro: "Sotuvlar tempi, biznesni kengaytirish, xodimlar va jarayonlarni optimallashtirish bo'yicha strategik maslahatlar beraman.",
    suggestions: [
      "Sotuvlar tempini tahlil qiling: qolgan xonadonlarni qancha vaqtda sotib bo'lamiz?",
      "Qaysi turdagi xonadonlar yomon sotilmoqda va nima qilish kerak?",
      "Sotuv va undiruv bo'limi uchun KPI tizimini taklif qiling",
      "Keyingi obyektga o'tish uchun 6 oylik strategik reja tuzing",
    ],
  },
  cfo: {
    id: "cfo",
    name: "AI Moliyachi",
    role: "Bosh moliyaviy direktor (CFO)",
    icon: Calculator,
    avatar: "bg-emerald-500/15 text-emerald-400",
    accent: "bg-emerald-600",
    ring: "ring-emerald-200",
    intro: "Haftalik, oylik va yillik tushumlarni tahlil qilaman, kassa uzilishi xavfini baholayman va qarzdorlikni kamaytirish rejasini tuzaman.",
    suggestions: [
      "Keyingi 3 oy uchun kassa uzilishi (cash gap) xavfini baholang",
      "Qarzdorlarni segmentlang va undiruv rejasini tuzing",
      "Oylik tushumni qanday taqsimlash kerak (qurilish, zaxira, soliq)?",
      "To'lov turlari bo'yicha taqsimotda qanday xavflar bor?",
    ],
  },
  lawyer: {
    id: "lawyer",
    name: "AI Yurist",
    role: "Bosh yuridik maslahatchi",
    icon: Scale,
    avatar: "bg-amber-500/15 text-amber-400",
    accent: "bg-amber-600",
    ring: "ring-amber-200",
    intro: "O'zbekiston qonunchiligi asosida shartnomalarni tahlil qilaman, qarzdorlarga pretenziya xatlari tayyorlayman, notarial va ipoteka xavflarini baholayman.",
    suggestions: [
      "Eng uzoq kechiktirgan qarzdorga pretenziya xati tayyorlang",
      "Bo'lib to'lash shartnomasiga qo'shilishi kerak bo'lgan himoya bandlari",
      "Qarzdor bilan shartnomani bir tomonlama bekor qilish tartibi va xavflari",
      "Ipoteka orqali sotishda notarial rasmiylashtirish xavflari",
    ],
  },
};

export const AGENT_LIST = Object.values(AGENTS);
