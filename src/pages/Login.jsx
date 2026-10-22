import { COMPANY } from "../../shared/company.js";
import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { useAuth } from "../store/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ login: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(form.login, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-lg font-bold text-white">B</div>
          <div>
            <p className="font-semibold text-slate-900">Bahra Building</p>
            <p className="text-xs text-slate-500">{COMPANY.legalName} · Sotuv va to'lovlar CRM</p>
          </div>
        </div>
        <label className="label" htmlFor="login">Login</label>
        <input id="login" className="input mb-4" autoComplete="username" autoFocus value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
        <label className="label" htmlFor="password">Parol</label>
        <input id="password" type="password" className="input" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary mt-6 w-full py-2.5" disabled={busy || !form.login || !form.password}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Kirish
        </button>
        <p className="mt-4 text-center text-xs text-slate-400">Login va parolni administratordan oling</p>
      </form>
    </div>
  );
}
