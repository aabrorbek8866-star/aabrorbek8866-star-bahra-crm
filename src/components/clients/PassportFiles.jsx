import { useEffect, useRef, useState } from "react";
import { IdCard, Upload, Loader2, Trash2, FileText, X } from "lucide-react";
import { api } from "../../services/api";

const MAX_SIDE = 1800; // px — telefon rasmlari kichraytiriladi (bepul baza 0.5 GB)

/** Katta rasmni brauzerda kichraytirish (JPEG). PDF va kichik rasmlar o'zgarmaydi. */
async function shrink(file) {
  if (!file.type.startsWith("image/") || file.size < 700 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

/** Pasport nusxasi (old va orqa tomoni rasm yoki PDF). */
export default function PassportFiles({ clientId, canUpload, canDelete, onCountChange }) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState(null);

  const load = () =>
    api(`/clients/${clientId}/files`)
      .then((list) => {
        const passport = list.filter((f) => f.kind === "passport");
        setFiles(passport);
        onCountChange?.(passport.length);
      })
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (list) => {
    if (!list?.length) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      for (const f of [...list].slice(0, 4)) form.append("files", await shrink(f));
      await api(`/clients/${clientId}/files`, { method: "POST", form });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (f) => {
    if (!confirm(`"${f.name}" o'chirilsinmi?`)) return;
    try {
      await api(`/clients/${clientId}/files/${f.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><IdCard size={17} /> Pasport nusxasi</h2>
      {files.length > 0 ? (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {files.map((f) => (
            <div key={f.id} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {f.mime.startsWith("image/") ? (
                <button onClick={() => setView(f)} className="block h-28 w-full">
                  <img src={f.url} alt={f.name} className="h-full w-full object-cover" loading="lazy" />
                </button>
              ) : (
                <a href={f.url} target="_blank" rel="noreferrer" className="flex h-28 flex-col items-center justify-center gap-1 text-xs text-slate-600">
                  <FileText size={26} className="text-red-500" /> PDF
                </a>
              )}
              <p className="truncate px-2 py-1 text-[11px] text-slate-500">{f.name}</p>
              {canDelete && (
                <button onClick={() => remove(f)} className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-slate-500 opacity-0 shadow transition hover:text-red-600 group-hover:opacity-100" title="O'chirish">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-sm text-slate-500">Pasport nusxasi yuklanmagan.</p>
      )}
      {canUpload && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-200 p-3 text-center text-sm text-slate-500 hover:border-brand-400 hover:bg-brand-50/40"
        >
          {busy ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
          <span className="mt-1">Rasm yoki PDF (old va orqa tomoni)</span>
          <span className="text-[11px] text-slate-400">JPG, PNG, PDF · 5 MB gacha · telefondan suratga olish mumkin</span>
          <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {view && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/80 p-4" onClick={() => setView(null)}>
          <button className="absolute right-4 top-4 text-white" aria-label="Yopish"><X size={26} /></button>
          <img src={view.url} alt={view.name} className="max-h-full max-w-full rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}
