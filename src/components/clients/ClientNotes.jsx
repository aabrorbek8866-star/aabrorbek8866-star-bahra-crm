import { useEffect, useState } from "react";
import { StickyNote, Send, Trash2, Loader2 } from "lucide-react";
import { api } from "../../services/api";
import { useAuth } from "../../store/AuthContext";

/** Mijoz kabinetidagi qo'shimcha yozuvlar: kim, qachon, nima yozgani. */
export default function ClientNotes({ clientId }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/clients/${clientId}/notes`).then(setNotes).catch((e) => setError(e.message));
  }, [clientId]);

  const add = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const note = await api(`/clients/${clientId}/notes`, { method: "POST", body: { text } });
      setNotes((n) => [note, ...n]);
      setText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Izoh o'chirilsinmi?")) return;
    try {
      await api(`/clients/${clientId}/notes/${id}`, { method: "DELETE" });
      setNotes((n) => n.filter((x) => x.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><StickyNote size={17} /> Izohlar</h2>
      <form onSubmit={add} className="mb-4">
        <textarea
          rows={3}
          className="input resize-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) add(e); }}
          placeholder="Masalan: 25-oktabrda qo'ng'iroq qilindi, noyabr boshida to'lashni va'da qildi."
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Ctrl + Enter — saqlash</span>
          <button className="btn-primary px-3 py-1.5 text-xs" disabled={busy || !text.trim()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Qo'shish
          </button>
        </div>
      </form>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      {notes.length === 0 ? (
        <p className="text-sm text-slate-400">Hozircha izoh yo'q.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="group rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="whitespace-pre-wrap text-sm text-slate-800">{n.text}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                <span>{n.author ?? "—"} · {new Date(n.createdAt).toLocaleString("ru-RU")}</span>
                {(n.createdBy === user.id || user.role === "admin") && (
                  <button className="ml-auto opacity-0 transition hover:text-red-600 group-hover:opacity-100" onClick={() => remove(n.id)} title="O'chirish">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
