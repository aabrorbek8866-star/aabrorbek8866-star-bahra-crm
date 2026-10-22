import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Send, Scale, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useCrm } from "../store/CrmContext";
import { useAuth } from "../store/AuthContext";
import { fillSmsTemplate as fillTemplate } from "../../shared/building.js";
import { PageHeader, Modal, Badge, EmptyState } from "../components/ui";
import { useAgents } from "../components/ai/AgentContext";
import { sendSms } from "../services/api";
import { debtSeverity } from "../../shared/debt.js";
import { fmtDate, fmtMoney } from "../utils/format";

const DEFAULT_TEMPLATE =
  "Hurmatli {fio}! Bahra Building: {xonadon}-xonadon bo'yicha {qarz} so'm muddati o'tgan qarzdorlik mavjud ({kun} kun). Iltimos, 5 kun ichida to'lovni amalga oshiring. Tel: +998 71 000-00-00";

export default function Debtors() {
  const { debtors, smsLog, reload } = useCrm();
  const { can } = useAuth();
  const { open } = useAgents();
  const [selected, setSelected] = useState(new Set());
  const [smsOpen, setSmsOpen] = useState(false);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const total = debtors.reduce((s, c) => s + c.debt, 0);
  const targets = useMemo(() => debtors.filter((c) => selected.has(c.id)), [debtors, selected]);
  const lastSms = useMemo(() => {
    const m = new Map();
    (smsLog ?? []).forEach((e) => !m.has(e.clientId) && e.ok && m.set(e.clientId, e.at));
    return m;
  }, [smsLog]);

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => (s.size === debtors.length ? new Set() : new Set(debtors.map((c) => c.id))));

  const openSms = (ids) => { if (ids) setSelected(new Set(ids)); setResult(null); setSmsOpen(true); };

  const send = async () => {
    setSending(true);
    try {
      setResult(await sendSms(targets.map((c) => c.id), template));
      reload(); // SMS jurnali yangilansin
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Qarzdorlar"
        subtitle={`${debtors.length} ta mijozning to'lov muddati o'tgan · jami ${fmtMoney(total)}`}
        actions={
          <>
            {can("ai:use") && <button
              className="btn-secondary"
              onClick={() => open("lawyer", "Qarzdorlar ro'yxati asosida: (1) kechikish muddatiga ko'ra yuridik choralar bosqichlarini tuzing; (2) 90+ kunlik qarzdorlar uchun namunaviy pretenziya xati tayyorlang.")}
            >
              <Scale size={16} /> AI Yurist bilan xat tayyorlash
            </button>}
            {can("sms:send") && (
              <button className="btn-danger" disabled={selected.size === 0} onClick={() => openSms()}>
                <MessageSquare size={16} /> SMS yuborish ({selected.size})
              </button>
            )}
          </>
        }
      />

      <div className="card overflow-hidden border-red-200">
        {debtors.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Qarzdorlar yo'q" text="Barcha mijozlar to'lovlarni o'z vaqtida amalga oshirmoqda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-red-600 text-white">
                <tr>
                  <th className="px-4 py-3"><input type="checkbox" checked={selected.size === debtors.length} onChange={toggleAll} aria-label="Barchasini tanlash" /></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Mijoz</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Xonadon</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Oxirgi to'lov</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Kechikish</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Qarz</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {debtors.map((c) => {
                  const sev = debtSeverity(c.overdueDays);
                  return (
                    <tr key={c.id} className="bg-red-50/70 hover:bg-red-100/70">
                      <td className="px-4 py-3 text-center"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                      <td className="td">
                        <Link to={`/mijozlar/${c.id}`} className="font-semibold text-red-700 hover:underline">{c.fullName}</Link>
                        <div className="text-xs text-slate-500">{c.phone} · {c.contractNumber}</div>
                        {lastSms.has(c.id) && <div className="text-[11px] text-slate-400">SMS: {fmtDate(lastSms.get(c.id))}</div>}
                      </td>
                      <td className="td">№{c.apartmentId}</td>
                      <td className="td whitespace-nowrap">{fmtDate(c.lastPaymentDate)}</td>
                      <td className="td"><Badge className={sev.cls}>{c.overdueDays} kun</Badge></td>
                      <td className="td whitespace-nowrap text-right font-bold text-red-700">{fmtMoney(c.debt)}</td>
                      <td className="td">
                        {can("sms:send") && (
                          <button className="btn-secondary whitespace-nowrap px-2.5 py-1.5 text-xs" onClick={() => openSms([c.id])}>
                            <Send size={14} /> SMS
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={smsOpen} onClose={() => setSmsOpen(false)} title={`SMS xabarnoma — ${targets.length} ta mijoz`} wide>
        {result ? (
          <SmsResult result={result} onClose={() => { setSmsOpen(false); setSelected(new Set()); }} />
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label">Xabar shabloni</label>
              <textarea className="input h-28 resize-none" value={template} onChange={(e) => setTemplate(e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">
                O'zgaruvchilar: <code>{"{fio}"}</code> <code>{"{xonadon}"}</code> <code>{"{qarz}"}</code> <code>{"{kun}"}</code> <code>{"{shartnoma}"}</code> · {template.length} belgi
              </p>
            </div>
            {targets[0] && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-slate-500">Namuna ({targets[0].fullName}):</p>
                <p className="text-slate-800">{fillTemplate(template, targets[0])}</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setSmsOpen(false)}>Bekor qilish</button>
              <button className="btn-danger" disabled={sending || targets.length === 0} onClick={send}>
                {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Yuborish
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function SmsResult({ result, onClose }) {
  if (result.error) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Xatolik: {result.error}. Backend ishga tushirilganini tekshiring.</p>
        <div className="flex justify-end"><button className="btn-secondary" onClick={onClose}>Yopish</button></div>
      </div>
    );
  }
  const ok = result.results.filter((r) => r.ok).length;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800">
        <CheckCircle2 />
        <div>
          <p className="font-semibold">{ok} / {result.results.length} ta SMS yuborildi</p>
          {result.dryRun && <p className="text-xs">Test rejimi (DRY-RUN): SMS provayder sozlanmagan, xabarlar faqat server logiga yozildi.</p>}
        </div>
      </div>
      {result.results.some((r) => !r.ok) && (
        <ul className="text-sm text-red-700">{result.results.filter((r) => !r.ok).map((r) => <li key={r.clientId}>• {r.fullName}: {r.error}</li>)}</ul>
      )}
      <div className="flex justify-end"><button className="btn-primary" onClick={onClose}>Tayyor</button></div>
    </div>
  );
}
