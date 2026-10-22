import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users } from "lucide-react";
import { useCrm } from "../store/CrmContext";
import { PageHeader, Badge, EmptyState, ProgressBar } from "../components/ui";
import { fmtDate, fmtMoney } from "../utils/format";

export default function Clients() {
  const { clients } = useCrm();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return clients
      .filter((c) => (filter === "debtors" ? c.isDebtor : filter === "ok" ? !c.isDebtor : true))
      .filter((c) => !s || [c.fullName, c.phone, c.contractNumber, c.passport, String(c.apartmentId)].some((v) => v?.toLowerCase().includes(s)))
      .sort((a, b) => a.apartmentId - b.apartmentId);
  }, [clients, q, filter]);

  return (
    <>
      <PageHeader title="Mijozlar" subtitle={`Jami ${clients.length} ta mijoz`} />
      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input className="input pl-9" placeholder="F.I.O, telefon, shartnoma yoki xonadon raqami..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Barchasi</option>
          <option value="ok">To'lov o'z vaqtida</option>
          <option value="debtors">Qarzdorlar</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {list.length === 0 ? (
          <EmptyState icon={Users} title="Mijoz topilmadi" text="Qidiruv shartini o'zgartiring yoki Excel orqali bazani yuklang." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Xonadon</th><th className="th">Mijoz</th><th className="th">Shartnoma</th>
                  <th className="th">Oxirgi to'lov</th><th className="th w-48">To'langan</th><th className="th">Holati</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((c) => (
                  <tr key={c.id} className={c.isDebtor ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-slate-50"}>
                    <td className="td font-semibold">№{c.apartmentId}<div className="text-xs font-normal text-slate-400">{c.apartment?.entrance}-pod, {c.apartment?.floor}-qavat</div></td>
                    <td className="td">
                      <Link to={`/mijozlar/${c.id}`} className={`font-medium hover:underline ${c.isDebtor ? "text-red-700" : "text-brand-700"}`}>{c.fullName}</Link>
                      <div className="text-xs text-slate-400">{c.phone}</div>
                    </td>
                    <td className="td">{c.contractNumber}<div className="text-xs text-slate-400">{fmtDate(c.contractDate)}</div></td>
                    <td className="td whitespace-nowrap">{fmtDate(c.lastPaymentDate)}</td>
                    <td className="td">
                      <ProgressBar value={c.progress} tone={c.isDebtor ? "bg-red-500" : "bg-emerald-500"} />
                      <div className="mt-1 text-xs text-slate-500">{fmtMoney(c.paid)}</div>
                    </td>
                    <td className="td">
                      {c.isDebtor
                        ? <Badge className="bg-red-100 text-red-700">Qarz: {fmtMoney(c.debt)}</Badge>
                        : c.remaining === 0
                          ? <Badge className="bg-brand-100 text-brand-800">To'liq to'langan</Badge>
                          : <Badge className="bg-emerald-100 text-emerald-700">O'z vaqtida</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
