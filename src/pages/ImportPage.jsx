import { Download, FileSpreadsheet } from "lucide-react";
import { useCrm } from "../store/CrmContext";
import { PageHeader } from "../components/ui";
import ExcelImport from "../components/import/ExcelImport";
import { downloadFullWorkbook, downloadPaymentSchedule } from "../utils/excel";

export default function ImportPage() {
  const crm = useCrm();
  return (
    <>
      <PageHeader
        title="Excel orqali import"
        subtitle="C-blok fayli: 56 xonadon, mijozlar va har bir xonadonning to'lovlari"
        actions={
          <>
            <button className="btn-secondary" onClick={() => downloadFullWorkbook(crm, false)}><Download size={16} /> To'liq ma'lumot shabloni</button>
            <button className="btn-secondary" onClick={() => downloadPaymentSchedule(null)}><FileSpreadsheet size={16} /> To'lovlar jadvali shabloni</button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
          <p className="font-semibold">1. To'liq ma'lumot (C-blok fayli) — shu sahifada yuklanadi</p>
          <p className="mt-1">
            <b>"umumiy"</b> varag'i: Etaj, Podez, Xonadon raqami, Maydoni (м.2), Umumiy maydoni, Yashash maydoni,
            Shartnoma raqami, Shartnoma sanasi, Shartnoma summasi, Ism Familya. Sotilmagan xonadonga "sotilmagan" deb yoziladi.
          </p>
          <p className="mt-1">
            Ixtiyoriy ustunlar: Xonalar soni, Telefon, Pasport, Boshlang'ich to'lov, Oylik to'lov, Muddat (oy) — bo'lmasa, keyin kabinetda kiritiladi.
          </p>
          <p className="mt-1"><b>"1-xonadon" … "56-xonadon"</b> varaqlari: har bir xonadonning to'lovlari.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">2. To'lovlar jadvali (bitta mijoz) — mijoz kabinetida yuklanadi</p>
          <p className="mt-1">
            Ustunlar: Sana · Officega to'lov · Terminal Humo · Terminal uzcard · Bank · Shartnoma summasi · Izoh (ixtiyoriy).
            Bir qatorda bir nechta ustun to'ldirilsa, har biri alohida to'lov bo'ladi.
          </p>
          <p className="mt-1 text-slate-500">Mijozlar → mijozni oching → "To'lovlar tarixi" → <b>Excel'dan yuklash</b>.</p>
        </div>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Sanalar 29.08.2020, 26.10. 2020, 06,08,2026 yoki Excel sana formatida bo'lishi mumkin. Bir faylni qayta yuklasangiz, to'lovlar ikki marta yozilmaydi.
        Excelda bo'sh qoldirilgan maydon/xonalar soni saytda kiritilganini o'chirmaydi.
      </p>
      <ExcelImport onConfirm={crm.importData} />
    </>
  );
}
