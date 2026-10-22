import { useEffect, useState } from "react";
import { UserPlus, KeyRound, Loader2, Bot } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../store/AuthContext";
import { PageHeader, Modal, Badge } from "../components/ui";
import { fmtDate } from "../utils/format";

const ROLES = {
  admin: { label: "Rahbar (administrator)", desc: "Hamma narsa: import, xodimlar, to'lovni o'chirish, jurnal", badge: "bg-violet-100 text-violet-800" },
  manager: { label: "Menejer", desc: "To'lov qo'shish/tahrirlash, PDF, SMS, AI agentlar", badge: "bg-brand-100 text-brand-800" },
  cashier: { label: "Kassir", desc: "Mijozlarni ko'rish va to'lov qo'shish", badge: "bg-slate-100 text-slate-700" },
};

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null); // { mode: "create" } | { mode: "password", user }
  const [error, setError] = useState("");

  const load = () => api("/users").then(setUsers).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const patch = async (id, body) => {
    try {
      await api(`/users/${id}`, { method: "PATCH", body });
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Xodimlar"
        subtitle="Tizimga kirish huquqi va rollar"
        actions={<button className="btn-primary" onClick={() => setModal({ mode: "create" })}><UserPlus size={16} /> Yangi xodim</button>}
      />
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {Object.entries(ROLES).map(([k, r]) => (
          <div key={k} className="card p-4">
            <Badge className={r.badge}>{r.label}</Badge>
            <p className="mt-2 text-xs text-slate-500">{r.desc}</p>
          </div>
        ))}
      </div>

      <AiCheck />

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr><th className="th">Xodim</th><th className="th">Login</th><th className="th">Rol</th><th className="th">Qo'shilgan</th><th className="th">Holati</th><th className="th" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <td className="td font-medium">{u.fullName}{u.id === me.id && <span className="ml-1 text-xs text-slate-400">(siz)</span>}</td>
                <td className="td">{u.login}</td>
                <td className="td">
                  <select className="input py-1" value={u.role} disabled={u.id === me.id} onChange={(e) => patch(u.id, { role: e.target.value })}>
                    {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
                  </select>
                </td>
                <td className="td">{fmtDate(u.createdAt?.slice(0, 10))}</td>
                <td className="td">
                  {u.id === me.id ? <Badge className="bg-emerald-100 text-emerald-700">Faol</Badge> : (
                    <button className={`btn px-2.5 py-1 text-xs ${u.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`} onClick={() => patch(u.id, { active: !u.active })}>
                      {u.active ? "Faol" : "O'chirilgan"}
                    </button>
                  )}
                </td>
                <td className="td text-right">
                  <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => setModal({ mode: "password", user: u })}><KeyRound size={14} /> Parol</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === "create" ? "Yangi xodim" : `Yangi parol — ${modal?.user?.fullName}`}>
        {modal && <UserForm modal={modal} onDone={() => { setModal(null); load(); }} />}
      </Modal>
    </>
  );
}

function UserForm({ modal, onDone }) {
  const create = modal.mode === "create";
  const [form, setForm] = useState({ fullName: "", login: "", role: "cashier", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (create) await api("/users", { method: "POST", body: form });
      else await api(`/users/${modal.user.id}`, { method: "PATCH", body: { password: form.password } });
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {create && (
        <>
          <div><label className="label">F.I.O</label><input className="input" value={form.fullName} onChange={set("fullName")} /></div>
          <div><label className="label">Login (lotin harflari)</label><input className="input" value={form.login} onChange={set("login")} placeholder="masalan: kassir1" /></div>
          <div>
            <label className="label">Rol</label>
            <select className="input" value={form.role} onChange={set("role")}>
              {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
            </select>
          </div>
        </>
      )}
      <div><label className="label">Parol (kamida 8 belgi)</label><input type="text" className="input" value={form.password} onChange={set("password")} autoComplete="new-password" /></div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end"><button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Saqlash</button></div>
    </form>
  );
}

/** AI kaliti va ulanishni tekshirish (kalitning o'zi ko'rsatilmaydi). */
function AiCheck() {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      setResult(await api("/ai/diagnose"));
    } catch (e) {
      setResult({ ok: false, error: e.message });
    } finally {
      setBusy(false);
    }
  };
  const label = { anthropic: "Claude", gemini: "Google Gemini (bepul)", none: "o'rnatilmagan" };
  return (
    <div className="card mb-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Bot size={18} className="text-slate-500" />
        <p className="flex-1 text-sm font-medium text-slate-800">AI yordamchilar ulanishi</p>
        <button className="btn-secondary" onClick={run} disabled={busy}>
          {busy && <Loader2 size={15} className="animate-spin" />} Tekshirish
        </button>
      </div>
      {result && (
        <div className={`mt-3 rounded-lg p-3 text-sm ${result.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>
          <p><b>Xizmat:</b> {label[result.provider] ?? result.provider ?? "—"} · <b>{result.ok ? "ishlayapti ✓" : "xato"}</b></p>
          {result.keyLength !== undefined && <p className="text-xs">Kalit: {result.keyPrefix}… ({result.keyLength} belgi)</p>}
          {result.models && <p className="text-xs">Mavjud modellar: {result.models.join(", ") || "—"}</p>}
          {result.error && <p className="mt-1">{result.error}</p>}
          {result.detail && <p className="mt-1 break-all font-mono text-xs opacity-80">{result.detail}</p>}
        </div>
      )}
    </div>
  );
}
