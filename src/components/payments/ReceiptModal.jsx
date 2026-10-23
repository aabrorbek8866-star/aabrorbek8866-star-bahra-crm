import { useEffect, useMemo, useRef, useState } from "react";
import { Printer, Download, Loader2 } from "lucide-react";
import { Modal } from "../ui";
import { downloadBlob, renderTemplate } from "../../utils/docx";
import { receiptTemplateData, toCyrillic } from "../../../shared/notary.js";
import { fmtMoney } from "../../utils/format";
import { receiptHtml } from "./receiptHtml";

const TEMPLATE_URL = "/templates/chek_shablon.docx";
const LOGO_URL = "/templates/bahra-logo.png";

/**
 * To'lov cheki (ma'lumotnoma): mijoz F.I.Sh., xonadon, qavat, shartnoma raqami, summa (raqam va so'z bilan).
 * Ekranda va printerda — HTML nusxa (aniq A4 ko'rinish), "Word" — kompaniya shabloni asosidagi .docx.
 */
export default function ReceiptModal({ client, payment, onClose }) {
  const iframeRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const data = useMemo(
    () =>
      payment &&
      receiptTemplateData({
        chekRaqam: payment.id,
        sana: payment.date,
        qavat: client.apartment?.floor,
        xonadon: client.apartmentId,
        shartnomaRaqami: client.contractNumber,
        fio: client.fullNameCyr || toCyrillic(client.fullName),
        summa: payment.amount,
      }),
    [payment, client],
  );
  // Logo chek ichiga joylanadi (data URL) — chop etish paytida rasm yuklanmay qolmasin
  const [logo, setLogo] = useState(null);
  useEffect(() => {
    fetch(LOGO_URL)
      .then((r) => r.blob())
      .then((b) => new Promise((resolve) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.readAsDataURL(b); }))
      .then(setLogo)
      .catch(() => setLogo(LOGO_URL));
  }, []);
  const html = useMemo(() => (data && logo ? receiptHtml(data, logo) : ""), [data, logo]);

  /** A4 varaqni ekrandagi oyna kengligiga moslab kichraytirish (printerga ta'sir qilmaydi). */
  const fit = () => {
    const doc = iframeRef.current?.contentDocument;
    const sheet = doc?.querySelector(".sheet");
    if (!sheet) return;
    doc.documentElement.style.setProperty("--fit", "1");
    const ratio = Math.min(1, (iframeRef.current.clientWidth - 24) / sheet.offsetWidth);
    doc.documentElement.style.setProperty("--fit", String(ratio));
  };

  const surname = client.fullName.split(/\s+/)[0].replace(/[^A-Za-z0-9-]/g, "") || "mijoz";

  const downloadWord = async () => {
    setBusy(true);
    setError("");
    try {
      downloadBlob(await renderTemplate(TEMPLATE_URL, data), `Chek_${payment.id}_${client.apartmentId}-xonadon_${surname}.docx`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const print = () => {
    iframeRef.current.contentWindow.focus();
    iframeRef.current.contentWindow.print();
  };

  return (
    <Modal open={!!payment} onClose={onClose} title={payment ? `Chek №${payment.id} — ${fmtMoney(payment.amount)}` : ""} wide>
      {payment && (
        <div className="space-y-3">
          <div className="h-[62vh] overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
            {html ? (
              <iframe ref={iframeRef} title="Chek" className="h-full w-full" srcDoc={html} onLoad={fit} />
            ) : (
              <div className="grid h-full place-items-center text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /></div>
            )}
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <p className="mr-auto text-xs text-slate-500">A4 varaqda 2 nusxa: mijozga va kompaniyaga.</p>
            <button className="btn-secondary" disabled={busy} onClick={downloadWord}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Word
            </button>
            <button className="btn-primary" onClick={print} disabled={!html}>
              <Printer size={16} /> Chop etish
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
