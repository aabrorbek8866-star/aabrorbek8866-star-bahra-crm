import { useState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { Modal } from "../ui";
import { sendSms } from "../../services/api";
import { fillSmsTemplate } from "../../../shared/building.js";
import { COMPANY } from "../../../shared/company.js";

const TEMPLATES = {
  reminder: `Hurmatli {fio}! ${COMPANY.brand}: {xonadon}-xonadon bo'yicha navbatdagi to'lov vaqti yaqinlashdi. Tel: ${COMPANY.phone}`,
  debt: `Hurmatli {fio}! ${COMPANY.brand}: {xonadon}-xonadon bo'yicha {qarz} so'm muddati o'tgan qarzdorlik mavjud ({kun} kun). Iltimos, to'lovni amalga oshiring. Tel: ${COMPANY.phone}`,
  custom: `Hurmatli {fio}! ${COMPANY.brand}: `,
};

/** Bitta mijozga SMS yuborish (shablon yoki erkin matn). */
export default function ClientSmsModal({ client, open, onClose, onSent }) {
  const [template, setTemplate] = useState(client.isDebtor ? TEMPLATES.debt : TEMPLATES.reminder);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const send = async () => {
    setSending(true);
    try {
      const res = await sendSms([client.id], template);
      setResult(res);
      onSent?.();
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setSending(false);
    }
  };

  const close = () => { setResult(null); onClose(); };
  const r = result?.results?.[0];

  return (
    <Modal open={open} onClose={close} title={`SMS — ${client.fullName}`}>
      {result ? (
        <div className="space-y-4">
          {result.error || !r?.ok ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Yuborilmadi: {result.error ?? r?.error}</p>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800">
              <CheckCircle2 />
              <div>
                <p className="font-semibold">SMS yuborildi: {client.phone}</p>
                {result.dryRun && <p className="text-xs">Test rejimi: SMS provayder (Eskiz) sozlanmagan — xabar faqat jurnalga yozildi.</p>}
              </div>
            </div>
          )}
          <div className="flex justify-end"><button className="btn-primary" onClick={close}>Yopish</button></div>
        </div>
      ) : (
        <div className="space-y-4">
          {!client.phone && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Mijozning telefon raqami kiritilmagan — avval "Tahrirlash" orqali kiriting.</p>}
          <div className="flex flex-wrap gap-2">
            {[["reminder", "Eslatma"], ["debt", "Qarzdorlik"], ["custom", "Erkin matn"]].map(([k, label]) => (
              <button key={k} className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setTemplate(TEMPLATES[k])}>{label}</button>
            ))}
          </div>
          <div>
            <label className="label">Xabar</label>
            <textarea className="input h-28 resize-none" value={template} onChange={(e) => setTemplate(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">
              O'zgaruvchilar: <code>{"{fio}"}</code> <code>{"{xonadon}"}</code> <code>{"{qarz}"}</code> <code>{"{kun}"}</code> <code>{"{shartnoma}"}</code>
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="mb-1 text-xs font-medium text-slate-500">Mijozga boradi ({client.phone || "telefon yo'q"}):</p>
            <p className="text-slate-800">{fillSmsTemplate(template, client)}</p>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={close}>Bekor qilish</button>
            <button className="btn-primary" disabled={sending || !client.phone || !template.trim()} onClick={send}>
              {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Yuborish
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
