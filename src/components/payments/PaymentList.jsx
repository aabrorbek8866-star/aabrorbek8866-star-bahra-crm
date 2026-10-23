import { useMemo, useState } from "react";
import { CreditCard, Landmark, Banknote, MessageSquareText, Pencil, Trash2, Receipt, Printer } from "lucide-react";
import { PAYMENT_TYPES } from "../../data/schema";
import { fmtDate, fmtMoney } from "../../utils/format";
import { Badge, EmptyState, Modal } from "../ui";
import PaymentForm from "./PaymentForm";

const ICONS = { humo: CreditCard, uzcard: CreditCard, bank: Landmark, cash: Banknote };

/**
 * Mijozning barcha to'lovlari ro'yxati (kassa, bank, terminallar).
 * Har bir to'lov tagida batafsil "Izoh" bloki ko'rsatiladi.
 */
export default function PaymentList({ payments, onUpdate, onDelete, onReceipt }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [editing, setEditing] = useState(null);

  const remove = async (p) => {
    if (!confirm(`${fmtDate(p.date)} dagi ${fmtMoney(p.amount)} to'lovni o'chirasizmi? Bu amal jurnalga yoziladi.`)) return;
    try {
      await onDelete(p.id);
    } catch (e) {
      alert(e.message);
    }
  };

  const years = useMemo(() => [...new Set(payments.map((p) => p.date.slice(0, 4)))].sort().reverse(), [payments]);
  const list = useMemo(
    () =>
      payments
        .filter((p) => typeFilter === "all" || p.type === typeFilter)
        .filter((p) => yearFilter === "all" || p.date.startsWith(yearFilter))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [payments, typeFilter, yearFilter],
  );

  const totalsByType = useMemo(() => {
    const t = { humo: 0, uzcard: 0, bank: 0, cash: 0 };
    list.forEach((p) => (t[p.type] += p.amount));
    return t;
  }, [list]);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {Object.entries(PAYMENT_TYPES).map(([k, m]) => (
          <button
            key={k}
            onClick={() => setTypeFilter(typeFilter === k ? "all" : k)}
            className={`rounded-xl border p-3 text-left transition ${typeFilter === k ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-200 hover:bg-slate-50"}`}
          >
            <p className="text-xs text-slate-500">{m.label}</p>
            <p className="font-semibold text-slate-900">{fmtMoney(totalsByType[k])}</p>
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-slate-500">Yil:</span>
        {["all", ...years].map((y) => (
          <button
            key={y}
            onClick={() => setYearFilter(y)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${yearFilter === y ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {y === "all" ? "Barchasi" : y}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">{list.length} ta to'lov</span>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Receipt} title="To'lovlar yo'q" text="Tanlangan filtr bo'yicha to'lov topilmadi." />
      ) : (
        <ol className="relative space-y-3 border-l-2 border-slate-100 pl-5">
          {list.map((p) => {
            const meta = PAYMENT_TYPES[p.type];
            const Icon = ICONS[p.type];
            return (
              <li key={p.id} className="relative">
                <span className="absolute -left-[29px] top-4 grid h-4 w-4 place-items-center rounded-full border-2 border-white" style={{ background: meta.color }} />
                <div className="rounded-xl border border-slate-200 bg-white">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-50 text-slate-600"><Icon size={18} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{fmtMoney(p.amount)}</p>
                      <p className="text-xs text-slate-500">{fmtDate(p.date)}</p>
                    </div>
                    <Badge className={meta.badge}>{meta.label}</Badge>
                    <div className="flex gap-1">
                      {onReceipt && (
                        <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Chek (chop etish)" onClick={() => onReceipt(p)}><Printer size={15} /></button>
                      )}
                      {onUpdate && (
                        <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Tahrirlash" onClick={() => setEditing(p)}><Pencil size={15} /></button>
                      )}
                      {onDelete && (
                        <button
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="O'chirish"
                          onClick={() => remove(p)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Izoh bloki — har bir to'lov tagida */}
                  <div className="flex gap-2 rounded-b-xl border-t border-slate-100 bg-amber-50/60 px-4 py-2.5 text-sm text-slate-700">
                    <MessageSquareText size={15} className="mt-0.5 shrink-0 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <p><span className="font-medium text-amber-800">Izoh: </span>{p.comment || <i className="text-slate-400">izoh kiritilmagan</i>}</p>
                      {(p.createdBy || p.updatedBy) && (
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {p.createdBy && `Kiritdi: ${p.createdBy}`}
                          {p.updatedBy && ` · O'zgartirdi: ${p.updatedBy}, ${fmtDate(p.updatedAt)}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="To'lovni tahrirlash">
        {editing && (
          <PaymentForm
            initial={{ ...editing, amount: String(editing.amount) }}
            onCancel={() => setEditing(null)}
            onSubmit={async (patch) => { await onUpdate(editing.id, patch); setEditing(null); }}
          />
        )}
      </Modal>
    </div>
  );
}
