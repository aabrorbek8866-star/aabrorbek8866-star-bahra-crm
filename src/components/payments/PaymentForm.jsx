import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PAYMENT_TYPES } from "../../data/schema";
import { todayIso, fmtMoney } from "../../utils/format";

/**
 * Yangi to'lov qo'shish / mavjudini tahrirlash formasi.
 * "Izoh" maydoni majburiy — har bir to'lov asoslangan bo'lishi kerak.
 */
export default function PaymentForm({ initial, defaultAmount, onSubmit, onCancel }) {
  const [form, setForm] = useState(
    initial ?? { date: todayIso(), type: "humo", amount: defaultAmount ?? "", comment: "" },
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const amount = Number(String(form.amount).replace(/\s/g, ""));
    const errs = {};
    if (!form.date) errs.date = "Sanani kiriting";
    if (form.date > todayIso()) errs.date = "Kelajakdagi sana bo'lishi mumkin emas";
    if (!amount || amount <= 0) errs.amount = "Summa 0 dan katta bo'lishi kerak";
    if (form.comment.trim().length < 3) errs.comment = "Izoh majburiy (kamida 3 belgi): chek/kvitansiya raqami, kim qabul qildi va h.k.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await onSubmit({ date: form.date, type: form.type, amount, comment: form.comment.trim() });
    } catch (err) {
      setErrors({ server: err.message });
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <span className="label">To'lov turi</span>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(PAYMENT_TYPES).map(([key, meta]) => (
            <label
              key={key}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${
                form.type === key ? "border-brand-500 bg-brand-50 font-medium text-brand-800" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input type="radio" name="type" value={key} checked={form.type === key} onChange={set("type")} className="sr-only" />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
              {meta.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pay-date">To'lov sanasi</label>
          <input id="pay-date" type="date" className="input" value={form.date} max={todayIso()} onChange={set("date")} />
          {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
        </div>
        <div>
          <label className="label" htmlFor="pay-amount">Summa (so'm)</label>
          <input id="pay-amount" inputMode="numeric" className="input" value={form.amount} onChange={set("amount")} placeholder="12 500 000" />
          {Number(form.amount) > 0 && <p className="mt-1 text-xs text-slate-500">{fmtMoney(form.amount)}</p>}
          {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="pay-comment">Izoh <span className="text-red-500">*</span></label>
        <textarea
          id="pay-comment"
          rows={3}
          className="input resize-none"
          value={form.comment}
          onChange={set("comment")}
          placeholder="Masalan: Oktabr oyi uchun. Humo terminal, chek №4521. Qabul qildi: kassir Aliyeva N."
        />
        {errors.comment && <p className="mt-1 text-xs text-red-600">{errors.comment}</p>}
      </div>

      {errors.server && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errors.server}</p>}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Bekor qilish</button>}
        <button type="submit" className="btn-primary" disabled={saving}>{saving && <Loader2 size={16} className="animate-spin" />}{initial ? "Saqlash" : "To'lovni qo'shish"}</button>
      </div>
    </form>
  );
}
