import { useRef, useState } from "react";
import { FileText, Upload, Download, Eye, Loader2 } from "lucide-react";
import { uploadContract } from "../../services/api";

/** Mijoz shartnomasini PDF formatda yuklash (bazaga saqlanadi) va yuklab olish. */
export default function ContractUpload({ client, canUpload, onUploaded }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file) => {
    if (!file) return;
    setError("");
    if (file.type !== "application/pdf") return setError("Faqat PDF fayl yuklash mumkin.");
    if (file.size > 10 * 1024 * 1024) return setError("Fayl 10 MB dan katta. Skanerlash sifatini pasaytirib qayta urinib ko'ring.");
    setBusy(true);
    try {
      onUploaded(await uploadContract(client.id, file));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const fileName = client.contractPdfName || `Shartnoma_${client.contractNumber}.pdf`;

  return (
    <div className="card p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Shartnoma (PDF)</h2>

      {client.contractPdfUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-600"><FileText size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{fileName}</p>
            <p className="text-xs text-slate-500">№ {client.contractNumber}</p>
          </div>
          <a href={client.contractPdfUrl} target="_blank" rel="noreferrer" className="btn-secondary px-2.5" title="Ko'rish"><Eye size={16} /></a>
          <a href={`${client.contractPdfUrl}&download=1`} className="btn-primary px-2.5" title="Yuklab olish"><Download size={16} /></a>
        </div>
      ) : (
        <p className="mb-3 text-sm text-slate-500">Shartnoma fayli hali yuklanmagan.</p>
      )}

      {canUpload && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          className="mt-3 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 hover:border-brand-400 hover:bg-brand-50/40"
        >
          {busy ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
          <span className="mt-1">{client.contractPdfUrl ? "Yangi versiyani yuklash" : "PDF faylni shu yerga tashlang yoki bosing"}</span>
          <span className="text-[11px] text-slate-400">10 MB gacha</span>
          <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(e) => handleFile(e.target.files[0])} />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
