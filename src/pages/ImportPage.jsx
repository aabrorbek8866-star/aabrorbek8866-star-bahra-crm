import { Download } from "lucide-react";
import { useCrm } from "../store/CrmContext";
import { PageHeader } from "../components/ui";
import ExcelImport from "../components/import/ExcelImport";
import { downloadTemplate } from "../utils/excel";

export default function ImportPage() {
  const { importData } = useCrm();
  return (
    <>
      <PageHeader
        title="Excel orqali import"
        subtitle="56 ta xonadon va mijozlar bazasini bitta Excel fayldan yuklang"
        actions={
<button className="btn-secondary" onClick={downloadTemplate}><Download size={16} /> Shablonni yuklab olish</button>
        }
      />
      <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
        <p className="font-semibold">Fayl tuzilmasi</p>
        <p className="mt-1">
          <b>"Mijozlar"</b> varag'i: Xonadon raqami, Podyezd, Qavat, Maydon (m²), Xonalar soni, Holati, F.I.O, Pasport, Telefon,
          Shartnoma raqami, Shartnoma sanasi, Umumiy narx, Boshlang'ich to'lov, Oylik to'lov, Muddat (oy), Oxirgi to'lov sanasi.
        </p>
        <p className="mt-1"><b>"To'lovlar"</b> varag'i (ixtiyoriy): Shartnoma raqami, Sana, Turi (Humo / Uzcard / Bank / Naqd), Summa, Izoh.</p>
        <p className="mt-1 text-brand-700">Ustun nomlari kichik farqlar bilan ham tanib olinadi. Sanalar 15.01.2024 yoki Excel sana formatida bo'lishi mumkin.</p>
      </div>
      <ExcelImport onConfirm={importData} />
    </>
  );
}
