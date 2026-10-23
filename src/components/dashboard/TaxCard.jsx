import { useEffect, useMemo, useState } from "react";
import { Landmark, Settings2, Loader2, Info } from "lucide-react";
import { api } from "../../services/api";
import { useAuth } from "../../store/AuthContext";
import { taxBase, taxEstimate, taxPeriods } from "../../utils/tax";
import { fmtMoney } from "../../utils/format";
import { Modal } from "../ui";

/** Dashboard: joriy oy / chorak / yil uchun taxminiy soliq. */
export default function TaxCard({ payments, clients }) {
  const { can } = useAuth();
  const [settings, setSettings] = useState(null);
  const [period, setPeriod] = useState("month");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api("/settings").then((s) => setSettings(s.tax)).catch(() => {});
  }, []);

  const periods = useMemo(() => taxPeriods(), []);
  const rows = useMemo(() => {
    if (!settings) return [];
    return periods.map((p) => {
      const base = taxBase(settings, { payments, clients }, p);
      return { ...p, base, ...taxEstimate(settings, base) };
    });
  }, [settings, periods, payments, clients]);
  const current = rows.find((r) => r.id === period);

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Landmark size={18} /></span>
        <div className="flex-1">
          <h2 className="font-semibold text-slate-900">Soliq (taxminiy)</h2>
          {settings && (
            <p className="text-xs text-slate-500">
              {settings.regime === "turnover" ? "Aylanmadan olinadigan soliq rejimi" : "Umumiy rejim: QQS + foyda solig'i"} ·
              baza: {settings.base === "notary" ? "notarius qilingan shartnomalar" : "kelib tushgan to'lovlar"}
            </p>
          )}
        </div>
        {can("settings:edit") && (
          <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => setEditing(true)}><Settings2 size={14} /> Sozlash</button>
        )}
      </div>

      {!settings ? (
        <div className="grid h-24 place-items-center text-slate-400"><Loader2 className="animate-spin" size={18} /></div>
      ) : (
        <>
          <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-1">
            {rows.map((r) => (
              <button key={r.id} onClick={() => setPeriod(r.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${period === r.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                {r.label}
              </button>
            ))}
          </div>
          {current && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Soliq bazasi</p>
                <p className="text-lg font-semibold text-slate-900">{fmtMoney(current.base)}</p>
                <dl className="mt-3 space-y-1.5 text-sm">
                  {current.lines.map((l) => (
                    <div key={l.label} className="flex justify-between gap-2">
                      <dt className="text-slate-600">{l.label}{l.hint && <span className="block text-[11px] text-slate-400">{l.hint}</span>}</dt>
                      <dd className="font-medium text-slate-900">{fmtMoney(l.amount)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs text-amber-800">To'lanadigan soliq — {current.label}</p>
                <p className="mt-1 text-2xl font-bold text-amber-900">{fmtMoney(current.total)}</p>
                {settings.regime === "general" && !settings.expenseShare && (
                  <p className="mt-2 text-[11px] text-amber-800">Foyda solig'i hisoblanmadi — "Sozlash"da xarajatlar ulushini kiriting.</p>
                )}
              </div>
            </div>
          )}
          <p className="mt-4 flex gap-1.5 text-[11px] text-slate-400">
            <Info size={13} className="shrink-0" />
            Taxminiy hisob. Kompaniyaning soliq rejimi, imtiyozlar va soliq bazasini buxgalter bilan tasdiqlang.
          </p>
        </>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title="Soliq sozlamalari">
        {editing && settings && <TaxSettingsForm initial={settings} onSaved={(s) => { setSettings(s); setEditing(false); }} />}
      </Modal>
    </div>
  );
}

function TaxSettingsForm({ initial, onSaved }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSaved((await api("/settings/tax", { method: "PUT", body: f })).tax);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <span className="label">Soliq rejimi</span>
        {[["turnover", "Aylanmadan olinadigan soliq", "Kichik biznes rejimi"], ["general", "Umumiy rejim", "QQS va foyda solig'i to'lovchisi"]].map(([v, t, d]) => (
          <label key={v} className={`mb-2 flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${f.regime === v ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}>
            <input type="radio" className="mt-1" checked={f.regime === v} onChange={() => setF({ ...f, regime: v })} />
            <span><b>{t}</b><span className="block text-xs text-slate-500">{d}</span></span>
          </label>
        ))}
      </div>
      {f.regime === "turnover" ? (
        <Num label="Aylanma solig'i stavkasi, %" value={f.turnoverRate} onChange={set("turnoverRate")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Num label="QQS, %" value={f.vatRate} onChange={set("vatRate")} />
          <Num label="Foyda solig'i, %" value={f.profitRate} onChange={set("profitRate")} />
          <Num label="Xarajatlar ulushi, %" value={f.expenseShare} onChange={set("expenseShare")} />
        </div>
      )}
      <div>
        <span className="label">Soliq bazasi</span>
        <select className="input" value={f.base} onChange={set("base")}>
          <option value="payments">Kelib tushgan to'lovlar (kassa, bank, terminal)</option>
          <option value="notary">Notarius qilingan shartnomalar summasi (notarius sanasi bo'yicha)</option>
        </select>
      </div>
      <p className="text-xs text-slate-500">2026 yil asosiy stavkalari: aylanma solig'i 4%, QQS 12%, foyda solig'i 15%.</p>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end"><button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Saqlash</button></div>
    </form>
  );
}

const Num = ({ label, value, onChange }) => (
  <div>
    <label className="label">{label}</label>
    <input type="number" step="0.1" min="0" max="100" className="input" value={value} onChange={onChange} />
  </div>
);
