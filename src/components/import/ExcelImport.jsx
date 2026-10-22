import { useRef, useState } from "react";
import { FileSpreadsheet, UploadCloud, AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { parseCrmWorkbook } from "../../utils/excel";
import { fmtDate, fmtMoney } from "../../utils/format";

/**
 * Excel import: fayl tanlash → tahlil va oldindan ko'rish (preview) → tasdiqlash.
 * Ma'lumot faqat foydalanuvchi "Import qilish" tugmasini bosgandan keyin bazaga yoziladi.
 */
export default function ExcelImport({ onConfirm }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("merge");
  const [done, setDone] = useState(null);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(null);

  const handle = async (file) => {
    if (!file) return;
    setBusy(true); setDone(null); setServerError(null); setFileName(file.name);
    try {
      setParsed(await parseCrmWorkbook(file));
    } catch (e) {
      setParsed({ apartments: [], clients: [], payments: [], errors: [`Faylni o'qib bo'lmadi: ${e.message}`], warnings: [] });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const confirm = async () => {
    if (mode === "replace" && !window.confirm("Bazadagi BARCHA mijozlar va to'lovlar o'chirilib, Exceldagi bilan almashtiriladi. Davom etasizmi?")) return;
    setSaving(true);
    setServerError(null);
    try {
      const { apartments, clients, payments } = parsed;
      setDone(await onConfirm({ apartments, clients, payments, mode }));
    } catch (e) {
      setServerError({ message: e.message, details: e.details ?? [] });
    } finally {
      setSaving(false);
    }
  };

  const canImport = parsed && parsed.errors.length === 0 && parsed.apartments.length > 0;
  const paidByApt = new Map();
  for (const p of parsed?.payments ?? []) {
    const e = paidByApt.get(p.apartmentId) ?? { n: 0, sum: 0 };
    paidByApt.set(p.apartmentId, { n: e.n + 1, sum: e.sum + p.amount });
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current?.click()}
        className="card flex cursor-pointer flex-col items-center border-2 border-dashed p-10 text-center hover:border-brand-400 hover:bg-brand-50/30"
      >
        {busy ? <Loader2 className="animate-spin text-brand-600" size={36} /> : <UploadCloud className="text-brand-600" size={36} />}
        <p className="mt-3 font-medium text-slate-800">Excel faylni shu yerga tashlang yoki tanlash uchun bosing</p>
        <p className="mt-1 text-sm text-slate-500">.xlsx · "umumiy" varag'i (56 xonadon) + "1-xonadon" … "56-xonadon" to'lov varaqlari</p>
        {fileName && <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-700"><FileSpreadsheet size={16} />{fileName}</p>}
        <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => handle(e.target.files[0])} />
      </div>

      {parsed && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Xonadonlar" value={parsed.apartments.length} />
            <Stat label="Sotilgan" value={parsed.apartments.filter((a) => a.status === "sold").length} />
            <Stat label="Mijozlar" value={parsed.clients.length} />
            <Stat label="To'lovlar" value={parsed.payments.length} />
          </div>

          {parsed.errors.length > 0 && (
            <Notice tone="red" icon={AlertCircle} title={`${parsed.errors.length} ta xatolik — tuzatib qayta yuklang`} items={parsed.errors} />
          )}
          {parsed.warnings.length > 0 && (
            <Notice tone="amber" icon={AlertTriangle} title={`${parsed.warnings.length} ta ogohlantirish`} items={parsed.warnings} />
          )}

          {parsed.clients.length > 0 && (
            <div className="card overflow-hidden">
              <p className="px-4 pt-4 text-sm font-semibold text-slate-800">Oldindan ko'rish ({parsed.clients.length} ta mijoz)</p>
              <div className="max-h-96 overflow-auto">
                <table className="mt-2 w-full">
                  <thead className="bg-slate-50">
                    <tr><th className="th">№</th><th className="th">F.I.O</th><th className="th">Maydon</th><th className="th">Shartnoma</th><th className="th">Sana</th><th className="th text-right">Summa</th><th className="th text-right">To'lovlar</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsed.clients.map((c) => (
                      <tr key={c.apartmentId}>
                        <td className="td">{c.apartmentId}</td><td className="td font-medium">{c.fullName}</td>
                        <td className="td">{parsed.apartments[c.apartmentId - 1]?.area || "—"} m²</td>
                        <td className="td">{c.contractNumber}</td><td className="td">{fmtDate(c.contractDate)}</td><td className="td text-right">{fmtMoney(c.totalPrice)}</td>
                        <td className="td text-right">{paidByApt.get(c.apartmentId)?.n ?? 0} ta · {fmtMoney(paidByApt.get(c.apartmentId)?.sum ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 flex-col gap-2 text-sm sm:flex-row sm:gap-6">
              <label className="flex items-center gap-2"><input type="radio" checked={mode === "merge"} onChange={() => setMode("merge")} /> Yangilash (PDF va mavjud to'lovlar saqlanadi)</label>
              <label className="flex items-center gap-2"><input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} /> To'liq almashtirish (eski to'lovlar o'chadi)</label>
            </div>
            {done ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700"><CheckCircle2 size={18} /> Bazaga saqlandi</span>
            ) : (
              <button className="btn-primary" disabled={!canImport || saving} onClick={confirm}>
                {saving && <Loader2 size={16} className="animate-spin" />} Import qilish
              </button>
            )}
          </div>

          {done && (
            <Notice
              tone="green"
              icon={CheckCircle2}
              title={`${done.clients} ta mijoz saqlandi · ${done.paymentsInserted} ta yangi to'lov qo'shildi${done.paymentsSkipped ? ` · ${done.paymentsSkipped} ta takroriy to'lov o'tkazib yuborildi` : ""}`}
              items={done.warnings}
            />
          )}
          {serverError && <Notice tone="red" icon={AlertCircle} title={serverError.message} items={serverError.details} />}
        </>
      )}
    </div>
  );
}

const Stat = ({ label, value }) => (
  <div className="card p-4"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold text-slate-900">{value}</p></div>
);

function Notice({ tone, icon: Icon, title, items }) {
  const cls = {
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[tone];
  return (
    <div className={`rounded-xl border p-4 text-sm ${cls}`}>
      <p className="mb-2 flex items-center gap-2 font-semibold"><Icon size={16} />{title}</p>
      {items.length > 0 && <ul className="max-h-40 space-y-0.5 overflow-y-auto pl-6">{items.map((t, i) => <li key={i} className="list-disc">{t}</li>)}</ul>}
    </div>
  );
}
