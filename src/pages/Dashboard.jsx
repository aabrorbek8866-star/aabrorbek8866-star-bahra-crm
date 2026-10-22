import { Link } from "react-router-dom";
import { Wallet, CalendarDays, CalendarRange, Building2, AlertTriangle, PiggyBank, Download } from "lucide-react";
import { useCrm } from "../store/CrmContext";
import { periodTotals } from "../utils/analytics";
import { fmtMoney, fmtShort, fmtDate } from "../utils/format";
import { downloadFullWorkbook } from "../utils/excel";
import { PageHeader, StatCard, ProgressBar } from "../components/ui";
import RevenueChart from "../components/dashboard/RevenueChart";
import PaymentTypePie from "../components/dashboard/PaymentTypePie";
import SalesChart from "../components/dashboard/SalesChart";
import { useAgents } from "../components/ai/AgentContext";
import { useAuth } from "../store/AuthContext";

const pct = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : null);

export default function Dashboard() {
  const crm = useCrm();
  const { apartments, clients, payments, debtors } = crm;
  const { open } = useAgents();
  const { can } = useAuth();
  const t = periodTotals(payments);

  const sold = apartments.filter((a) => a.status === "sold").length;
  const contractValue = clients.reduce((s, c) => s + c.totalPrice, 0);
  const collected = clients.reduce((s, c) => s + c.paid, 0);
  const totalDebt = debtors.reduce((s, c) => s + c.debt, 0);
  const recent = [...payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Asosiy panel"
        subtitle="Bahra Building — 7 qavat, 2 podyezd, 56 xonadon"
        actions={
          <>
            <button className="btn-secondary" onClick={() => downloadFullWorkbook(crm)}><Download size={16} /> Excelga eksport</button>
            {can("ai:use") && <button className="btn-primary" onClick={() => open("cfo", "Dashboard'dagi haftalik, oylik va yillik tushumlarni tahlil qilib, kassa uzilishi xavfini baholang.")}>
              AI Moliyachi tahlili
            </button>}
          </>
        }
      />

      {clients.length === 0 && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          Baza hozircha bo'sh. {can("import")
            ? <>Mijozlar va to'lovlarni <Link className="font-semibold underline" to="/import">Excel import</Link> bo'limidan yuklang.</>
            : "Administrator Excel orqali mijozlar bazasini yuklashi kerak."}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Shu hafta tushum" value={fmtMoney(t.week.value)} trend={pct(t.week.value, t.week.prev)} hint="o'tgan haftaga nisbatan" icon={CalendarDays} />
        <StatCard label="Shu oy tushum" value={fmtMoney(t.month.value)} trend={pct(t.month.value, t.month.prev)} hint="o'tgan oyga nisbatan" icon={CalendarRange} />
        <StatCard label="Shu yil tushum" value={fmtMoney(t.year.value)} trend={pct(t.year.value, t.year.prev)} hint="o'tgan yilga nisbatan" icon={Wallet} tone="green" />
        <StatCard label="Sotilgan xonadonlar" value={`${sold} / ${apartments.length}`} hint={`${apartments.length - sold} ta bo'sh`} icon={Building2} />
        <StatCard label="Yig'ilgan / shartnomalar" value={fmtShort(collected)} hint={`${fmtShort(contractValue)} dan, ${contractValue ? ((collected / contractValue) * 100).toFixed(1) : 0}%`} icon={PiggyBank} tone="green" />
        <StatCard label="Muddati o'tgan qarz" value={fmtMoney(totalDebt)} hint={`${debtors.length} ta qarzdor mijoz`} icon={AlertTriangle} tone="red" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><RevenueChart payments={payments} /></div>
        <PaymentTypePie payments={payments} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><SalesChart clients={clients} /></div>
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Eng katta qarzdorlar</h2>
            <Link to="/qarzdorlar" className="text-xs font-medium text-brand-600 hover:underline">Barchasi →</Link>
          </div>
          <ul className="space-y-3">
            {[...debtors].sort((a, b) => b.debt - a.debt).slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link to={`/mijozlar/${c.id}`} className="block rounded-lg p-2 hover:bg-red-50">
                  <div className="flex justify-between text-sm">
                    <span className="truncate font-medium text-slate-800">{c.fullName}</span>
                    <span className="font-semibold text-red-600">{fmtShort(c.debt)}</span>
                  </div>
                  <p className="text-xs text-slate-500">{c.apartmentId}-xonadon · {c.overdueDays} kun kechikkan</p>
                </Link>
              </li>
            ))}
            {debtors.length === 0 && <p className="text-sm text-slate-500">Qarzdorlar yo'q 🎉</p>}
          </ul>
        </div>
      </div>

      <div className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="font-semibold text-slate-900">So'nggi to'lovlar</h2>
          <span className="text-xs text-slate-500">Umumiy yig'ilgan: {fmtMoney(t.all)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full">
            <tbody className="divide-y divide-slate-100">
              {recent.map((p) => {
                const c = crm.clientById.get(p.clientId);
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="td whitespace-nowrap">{fmtDate(p.date)}</td>
                    <td className="td"><Link className="font-medium text-brand-700 hover:underline" to={`/mijozlar/${p.clientId}`}>{c?.fullName ?? "—"}</Link></td>
                    <td className="td max-w-xs truncate text-slate-500">{p.comment}</td>
                    <td className="td whitespace-nowrap text-right font-semibold">{fmtMoney(p.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 pb-5">
          <p className="mb-1 mt-2 text-xs text-slate-500">Shartnomalar bo'yicha yig'ilish darajasi</p>
          <ProgressBar value={contractValue ? (collected / contractValue) * 100 : 0} tone="bg-emerald-500" />
        </div>
      </div>
    </>
  );
}
