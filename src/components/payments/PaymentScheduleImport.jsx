import { useRef, useState } from "react";
import { UploadCloud, Loader2, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { parsePaymentScheduleFile, downloadPaymentSchedule } from "../../utils/excel";
import { PAYMENT_TYPES } from "../../data/schema";
import { fmtDate, fmtMoney } from "../../utils/format";

const simplify = (s) => String(s ?? "").toLowerCase().replace(/[^a-zа-яё]/gi, "").slice(0, 8);

/** Bitta mijozning to'lov jadvalini (Excel) yuklash: o'qish → tekshirish → saqlash. */
export default function PaymentScheduleImport({ client, onImport, onClose }) {
  const inputRef = useRef(null);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const handle = async (file) => {
    if (!file) return;
    setError(""); setParsed(null); setDone(null);
    try {
      setParsed(await parsePaymentScheduleFile(file));
    } catch (e) {
      setError(e.message);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const save = async () => {
    setBusy(true);
    try {
      setDone(await onImport({ payments: parsed.payments, totalPrice: parsed.totalPrice }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const total = parsed?.payments.reduce((s, p) => s + p.amount, 0) ?? 0;
  const nameMismatch = parsed?.title && simplify(parsed.title) !== simplify(client.fullName);
  const priceMismatch = parsed?.totalPrice && client.totalPrice && Math.round(parsed.totalPrice) !== client.totalPrice;

  if (done) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 />
          <p className="font-medium">{done.inserted} ta to'lov qo'shildi{done.skipped ? `, ${done.skipped} tasi oldin yuklangan (takrorlanmadi)` : ""}.</p>
        </div>
        <div className="flex justify-end"><button className="btn-primary" onClick={onClose}>Tayyor</button></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 hover:border-brand-400 hover:bg-brand-50/40"
      >
        <UploadCloud size={28} className="text-brand-600" />
        <p className="mt-2 font-medium text-slate-700">To'lov jadvali (Excel) faylini tanlang</p>
        <p className="text-xs">Ustunlar: Sana · Officega to'lov · Terminal Humo · Terminal uzcard · Bank · Shartnoma summasi · Izoh (ixtiyoriy)</p>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => handle(e.target.files[0])} />
      </div>
      <button className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline" onClick={() => downloadPaymentSchedule(null)}>
        <Download size={13} /> Bo'sh to'lov jadvali shablonini yuklab olish
      </button>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {parsed && (
        <>
          {(nameMismatch || priceMismatch) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> Tekshiring — fayl boshqa mijozniki bo'lishi mumkin</p>
              {nameMismatch && <p>Fayldagi ism: <b>{parsed.title}</b>, kabinet egasi: <b>{client.fullName}</b>.</p>}
              {priceMismatch && <p>Fayldagi shartnoma summasi: <b>{fmtMoney(parsed.totalPrice)}</b>, bazada: <b>{fmtMoney(client.totalPrice)}</b>.</p>}
            </div>
          )}
          {parsed.warnings.length > 0 && (
            <ul className="rounded-xl border border-amber-200 bg-amber-50 p-3 pl-7 text-xs text-amber-900">
              {parsed.warnings.map((w, i) => <li key={i} className="list-disc">{w}</li>)}
            </ul>
          )}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Stat label="To'lovlar" value={`${parsed.payments.length} ta`} />
            <Stat label="Jami to'langan" value={fmtMoney(total)} />
            <Stat label="Qoldiq" value={parsed.totalPrice ? fmtMoney(parsed.totalPrice - total) : "—"} />
          </div>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {parsed.payments.map((p, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-slate-500">{fmtDate(p.date)}</td>
                    <td className="px-3 py-1.5">{PAYMENT_TYPES[p.type].label}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{fmtMoney(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>Bekor qilish</button>
            <button className="btn-primary" disabled={busy || !parsed.payments.length} onClick={save}>
              {busy && <Loader2 size={16} className="animate-spin" />} {client.fullName.split(" ")[0]} kabinetiga saqlash
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const Stat = ({ label, value }) => (
  <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-xs text-slate-500">{label}</p><p className="font-semibold text-slate-900">{value}</p></div>
);
