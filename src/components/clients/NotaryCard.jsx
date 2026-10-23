import { useRef, useState } from "react";
import { Stamp, Upload, Eye, Download, Loader2, FileText, CheckCircle2, CircleDashed, Trash2, Pencil, Check } from "lucide-react";
import { api, removeNotary, uploadNotaryPdf } from "../../services/api";
import { fmtDate, fmtMoney, todayIso } from "../../utils/format";
import { Badge, Modal } from "../ui";
import NotaryDocsForm from "./NotaryDocsForm";

/**
 * Mijoz kabinetidagi "Notarius" bloki:
 *  - holat: notarius qilingan / qilinmagan
 *  - notarial tasdiqlangan shartnomani PDF ko'rinishida yuklash (yuklanganda "qilingan" bo'ladi)
 *  - notarius uchun hujjatlar to'plamini tayyorlash (shablon asosida)
 */
export default function NotaryCard({ client, can, onClientChange }) {
  const inputRef = useRef(null);
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [amount, setAmount] = useState(String(client.notaryAmount || client.totalPrice || ""));
  const [editingAmount, setEditingAmount] = useState(false);

  const saveAmount = async () => {
    setError("");
    try {
      onClientChange(await api(`/clients/${client.id}`, { method: "PATCH", body: { notaryAmount: Number(amount) || null } }));
      setEditingAmount(false);
    } catch (e) {
      setError(e.message);
    }
  };

  const upload = async (file) => {
    if (!file) return;
    setError("");
    if (file.type !== "application/pdf") return setError("Faqat PDF fayl yuklash mumkin.");
    if (file.size > 10 * 1024 * 1024) return setError("Fayl 10 MB dan katta.");
    setBusy(true);
    try {
      onClientChange(await uploadNotaryPdf(client.id, file, date, Number(amount) || null));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const unmark = async () => {
    if (!confirm("Notarius belgisi va yuklangan PDF o'chirilsinmi?")) return;
    try {
      onClientChange(await removeNotary(client.id));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Stamp size={17} /> Notarius</h2>
        {client.notarized
          ? <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle2 size={13} className="mr-1" /> Qilingan</Badge>
          : <Badge className="bg-slate-100 text-slate-600"><CircleDashed size={13} className="mr-1" /> Qilinmagan</Badge>}
      </div>

      {client.notarized && (
        <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2.5">
          <p className="text-xs text-emerald-700">Notarius qilingan summa</p>
          {editingAmount ? (
            <div className="mt-1 flex gap-2">
              <input inputMode="numeric" className="input py-1" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} autoFocus />
              <button className="btn-primary px-2.5 py-1" onClick={saveAmount} title="Saqlash"><Check size={15} /></button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold text-emerald-900">{client.notaryAmount ? fmtMoney(client.notaryAmount) : "kiritilmagan"}</p>
              {can("clients:edit") && (
                <button className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100" onClick={() => setEditingAmount(true)} title="O'zgartirish"><Pencil size={14} /></button>
              )}
            </div>
          )}
          {client.notaryAmount && client.totalPrice && client.notaryAmount !== client.totalPrice && (
            <p className="text-[11px] text-emerald-700">Shartnoma summasidan farqi: {fmtMoney(client.notaryAmount - client.totalPrice)}</p>
          )}
        </div>
      )}

      {client.notarized && client.notaryPdfUrl && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-emerald-700"><FileText size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{client.notaryPdfName || "Notarial shartnoma.pdf"}</p>
            <p className="text-xs text-slate-500">Notarius sanasi: {fmtDate(client.notarizedAt)}</p>
          </div>
          <a href={client.notaryPdfUrl} target="_blank" rel="noreferrer" className="btn-secondary px-2.5" title="Ko'rish"><Eye size={16} /></a>
          <a href={`${client.notaryPdfUrl}&download=1`} className="btn-primary px-2.5" title="Yuklab olish"><Download size={16} /></a>
        </div>
      )}

      {can("clients:edit") && (
        <button className="btn-primary mb-3 w-full" onClick={() => setPreparing(true)}>
          <FileText size={16} /> Notarius hujjatlarini tayyorlash
        </button>
      )}

      {can("contracts:upload") && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-3">
          <p className="mb-2 text-xs text-slate-500">
            {client.notarized ? "Yangi versiyani yuklash" : "Notariusda tasdiqlangan shartnomani PDF qilib yuklang — mijoz \"notarius qilingan\" deb belgilanadi."}
          </p>
          <label className="label">Notarial shartnomadagi summa (so'm)</label>
          <input inputMode="numeric" className="input mb-2" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
          <div className="flex gap-2">
            <input type="date" className="input" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} title="Notarius sanasi" />
            <button className="btn-secondary shrink-0" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} PDF
            </button>
          </div>
          <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(e) => upload(e.target.files[0])} />
        </div>
      )}
      {client.notarized && can("clients:delete") && (
        <button className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600" onClick={unmark}>
          <Trash2 size={12} /> Notarius belgisini bekor qilish
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <Modal open={preparing} onClose={() => setPreparing(false)} title={`Notarius hujjatlari — №${client.apartmentId} xonadon`} wide>
        {preparing && <NotaryDocsForm client={client} onClientChange={onClientChange} onClose={() => setPreparing(false)} />}
      </Modal>
    </div>
  );
}
