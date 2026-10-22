import { useState } from "react";
import { Loader2, Calculator, Trash2 } from "lucide-react";
import { fmtMoney, todayIso } from "../../utils/format";

const EMPTY = {
  fullName: "", phone: "", passport: "", contractNumber: "", contractDate: todayIso(),
  totalPrice: "", downPayment: "", monthlyPayment: "", installmentMonths: "",
};

const digits = (v) => String(v ?? "").replace(/[^\d]/g, "");
const toForm = (c) =>
  c
    ? {
        fullName: c.fullName, phone: c.phone, passport: c.passport, contractNumber: c.contractNumber, contractDate: c.contractDate,
        totalPrice: c.totalPrice ? String(c.totalPrice) : "", downPayment: c.downPayment ? String(c.downPayment) : "",
        monthlyPayment: c.monthlyPayment ? String(c.monthlyPayment) : "", installmentMonths: c.installmentMonths ? String(c.installmentMonths) : "",
      }
    : EMPTY;

/**
 * Mijoz ma'lumotlarini kiritish/tahrirlash: shaxsiy ma'lumotlar, shartnoma va to'lov grafigi.
 * client berilmasa — yangi mijoz (bo'sh xonadonni sotish).
 */
export default function ClientForm({ client, onSubmit, onDelete, onCancel }) {
  const [form, setForm] = useState(() => toForm(client));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setMoney = (k) => (e) => setForm({ ...form, [k]: digits(e.target.value) });

  const total = Number(form.totalPrice) || 0;
  const down = Number(form.downPayment) || 0;
  const months = Number(form.installmentMonths) || 0;
  const suggestMonthly = () =>
    months > 0 && total > down && setForm({ ...form, monthlyPayment: String(Math.ceil((total - down) / months / 1000) * 1000) });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.fullName.trim().length < 3) return setError("F.I.O ni kiriting");
    if (!form.contractNumber.trim()) return setError("Shartnoma raqamini kiriting");
    setBusy(true);
    try {
      await onSubmit({
        ...form,
        totalPrice: total, downPayment: down, monthlyPayment: Number(form.monthlyPayment) || 0, installmentMonths: months,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`${client.fullName} — sotuvni bekor qilasizmi? Xonadon "Bo'sh" holatiga qaytadi.`)) return;
    setBusy(true);
    try {
      await onDelete();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Section title="Mijoz">
        <Field label="F.I.O" span><input className="input" value={form.fullName} onChange={set("fullName")} autoFocus /></Field>
        <Field label="Telefon"><input className="input" value={form.phone} onChange={set("phone")} placeholder="+998 90 123-45-67" /></Field>
        <Field label="Pasport"><input className="input" value={form.passport} onChange={set("passport")} placeholder="AA 1234567" /></Field>
      </Section>

      <Section title="Shartnoma">
        <Field label="Shartnoma raqami"><input className="input" value={form.contractNumber} onChange={set("contractNumber")} /></Field>
        <Field label="Shartnoma sanasi"><input type="date" className="input" value={form.contractDate} onChange={set("contractDate")} /></Field>
        <Field label="Shartnoma summasi (so'm)" span>
          <input inputMode="numeric" className="input" value={form.totalPrice} onChange={setMoney("totalPrice")} placeholder="233400000" />
          {total > 0 && <p className="mt-1 text-xs text-slate-500">{fmtMoney(total)}</p>}
        </Field>
      </Section>

      <Section title="To'lov grafigi" hint="Kiritilsa, tizim muddati o'tgan qarzni avtomatik hisoblaydi va qarzdorlar ro'yxatini tuzadi.">
        <Field label="Boshlang'ich to'lov (so'm)">
          <input inputMode="numeric" className="input" value={form.downPayment} onChange={setMoney("downPayment")} />
          {down > 0 && <p className="mt-1 text-xs text-slate-500">{fmtMoney(down)}</p>}
        </Field>
        <Field label="Muddat (oy)"><input inputMode="numeric" className="input" value={form.installmentMonths} onChange={setMoney("installmentMonths")} placeholder="24" /></Field>
        <Field label="Oylik to'lov (so'm)" span>
          <div className="flex gap-2">
            <input inputMode="numeric" className="input" value={form.monthlyPayment} onChange={setMoney("monthlyPayment")} />
            <button type="button" className="btn-secondary shrink-0" onClick={suggestMonthly} disabled={!(months > 0 && total > down)} title="(Summa − boshlang'ich) ÷ muddat">
              <Calculator size={15} /> Hisoblash
            </button>
          </div>
          {Number(form.monthlyPayment) > 0 && <p className="mt-1 text-xs text-slate-500">{fmtMoney(form.monthlyPayment)}</p>}
        </Field>
      </Section>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
        {onDelete && (
          <button type="button" className="btn text-red-600 hover:bg-red-50" onClick={remove} disabled={busy}>
            <Trash2 size={15} /> Sotuvni bekor qilish
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>Bekor qilish</button>
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Saqlash</button>
        </div>
      </div>
    </form>
  );
}

const Section = ({ title, hint, children }) => (
  <fieldset>
    <legend className="mb-2 text-sm font-semibold text-slate-900">{title}</legend>
    {hint && <p className="-mt-1 mb-2 text-xs text-slate-500">{hint}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{children}</div>
  </fieldset>
);

const Field = ({ label, span, children }) => (
  <div className={span ? "sm:col-span-2" : ""}>
    <label className="label">{label}</label>
    {children}
  </div>
);
