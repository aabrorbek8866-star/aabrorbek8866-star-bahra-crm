import { Link } from "react-router-dom";
import { Stamp } from "lucide-react";
import { fmtMoney } from "../../utils/format";
import { ProgressBar } from "../ui";

/** Dashboard: notarius qilingan shartnomalar soni va summasi. */
export default function NotaryStats({ clients }) {
  const done = clients.filter((c) => c.notarized);
  const amount = done.reduce((s, c) => s + (c.notaryAmount || c.totalPrice || 0), 0);
  const left = clients.length - done.length;
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Stamp size={18} /></span>
        <h2 className="font-semibold text-slate-900">Notarius</h2>
      </div>
      <p className="text-2xl font-bold text-slate-900">{done.length} <span className="text-base font-medium text-slate-400">/ {clients.length}</span></p>
      <p className="mb-2 text-xs text-slate-500">shartnoma notarius qilingan</p>
      <ProgressBar value={clients.length ? (done.length / clients.length) * 100 : 0} tone="bg-emerald-500" />
      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between"><dt className="text-slate-500">Notarius qilingan summa</dt><dd className="font-semibold text-slate-900">{fmtMoney(amount)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-500">Qilinmagan</dt><dd className="font-medium text-slate-900">{left} ta</dd></div>
      </dl>
      {left > 0 && <Link to="/mijozlar" className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline">Ro'yxatni ko'rish →</Link>}
    </div>
  );
}
