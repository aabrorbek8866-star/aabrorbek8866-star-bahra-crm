import { useMemo, useState } from "react";
import { Download, Loader2, CheckCircle2 } from "lucide-react";
import { api, logNotaryDocs } from "../../services/api";
import { fmtDate, fmtMoney, todayIso } from "../../utils/format";
import { dative, moneyWithWords, notaryTemplateData, signatureName, splitPassport, toCyrillic } from "../../../shared/notary.js";

const TEMPLATE_URL = "/templates/notarius_shablon.docx";

const initial = (c) => {
  const apt = c.apartment ?? {};
  const pass = splitPassport(c.passport);
  return {
    fio: c.fullNameCyr || toCyrillic(c.fullName),
    pasportSeriya: pass.seriya,
    pasportRaqam: pass.raqam,
    pasportKimTomonidan: c.passportIssuedBy ?? "",
    pasportSanasi: c.passportIssuedAt ?? "",
    manzil: c.address ?? "",
    xonalar: apt.rooms ? String(apt.rooms) : "",
    umumiyMaydon: apt.totalArea ? String(apt.totalArea) : "",
    yashashMaydon: apt.livingArea ? String(apt.livingArea) : "",
  };
};

/**
 * Notarius uchun hujjatlar to'plami: oldi-sotdi shartnomasi, umumiy yig'ilish bayonlari (№1, №2),
 * qarzdorlik yo'qligi va qoldiq qiymat ma'lumotnomalari, sof aktivlar ma'lumotnomasi — bitta .docx.
 * Shartnoma raqami va sanasi — shartnomadan; boshqa barcha sanalar — tugma bosilgan kun.
 */
export default function NotaryDocsForm({ client, onClientChange, onClose }) {
  const [form, setForm] = useState(() => initial(client));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const today = todayIso();
  const apt = client.apartment ?? {};
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const data = useMemo(
    () => ({
      ...form,
      xonadon: client.apartmentId,
      podyezd: apt.entrance,
      qavat: apt.floor,
      narx: client.totalPrice,
      shartnomaRaqami: client.contractNumber,
      shartnomaSanasi: client.contractDate,
      sana: today,
      umumiyMaydon: Number(String(form.umumiyMaydon).replace(",", ".")),
      yashashMaydon: Number(String(form.yashashMaydon).replace(",", ".")),
    }),
    [form, client, apt, today],
  );

  const missing = [
    ["fio", "F.I.O (kirill)"], ["pasportSeriya", "Pasport seriyasi"], ["pasportRaqam", "Pasport raqami"],
    ["pasportKimTomonidan", "Pasport kim tomonidan berilgan"], ["pasportSanasi", "Pasport berilgan sana"],
    ["manzil", "Manzil"], ["xonalar", "Xonalar soni"], ["umumiyMaydon", "Umumiy maydon"], ["yashashMaydon", "Yashash maydoni"],
  ].filter(([k]) => !String(form[k] ?? "").trim()).map(([, label]) => label);
  if (!client.totalPrice) missing.push("Shartnoma summasi (mijoz ma'lumotlarida)");

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const [{ default: PizZip }, { default: Docxtemplater }, res] = await Promise.all([
        import("pizzip"),
        import("docxtemplater"),
        fetch(TEMPLATE_URL),
      ]);
      if (!res.ok) throw new Error("Shablon fayli topilmadi");
      const doc = new Docxtemplater(new PizZip(await res.arrayBuffer()), { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
      doc.render(notaryTemplateData(data));
      const blob = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      // Fayl nomi lotincha — ba'zi brauzerlar kirill harfli nomni "download" deb saqlaydi
      const surname = client.fullName.split(/\s+/)[0].replace(/[^A-Za-z0-9-]/g, "") || "mijoz";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Notarius_${client.apartmentId}-xonadon_${surname}_${today}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000); // yuklash boshlanishiga ulgursin

      // Kiritilgan rekvizitlar mijoz kabinetida saqlanadi — keyingi safar qayta yozish shart emas
      const updated = await api(`/clients/${client.id}`, {
        method: "PATCH",
        body: {
          fullNameCyr: form.fio.trim(),
          passport: `${form.pasportSeriya.trim()} ${form.pasportRaqam.trim()}`,
          passportIssuedBy: form.pasportKimTomonidan.trim(),
          passportIssuedAt: form.pasportSanasi,
          address: form.manzil.trim(),
        },
      });
      onClientChange(updated);
      logNotaryDocs(client.id, today).catch(() => {});
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Hujjatlar tayyor va yuklab olindi.</p>
            <p className="mt-1 text-sm">
              Faylni Word'da ochib tekshiring va chop eting. Notariusda tasdiqlangandan so'ng, shartnomaning PDF nusxasini
              shu kabinetdagi "Notarius" blokiga yuklang.
            </p>
          </div>
        </div>
        <div className="flex justify-end"><button className="btn-primary" onClick={onClose}>Yopish</button></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        Bitta Word fayl: <b>oldi-sotdi shartnomasi</b>, <b>umumiy yig'ilish bayonlari №1 va №2</b>, <b>qarzdorlik yo'qligi</b> va{" "}
        <b>qoldiq qiymat</b> ma'lumotnomalari, <b>sof aktivlar</b> ma'lumotnomasi. Shartnoma № {client.contractNumber} va sanasi{" "}
        ({fmtDate(client.contractDate)}) shartnomadan olinadi, qolgan barcha sanalar — bugun, <b>{fmtDate(today)}</b>.
      </div>

      <Group title="Xaridor (hujjatlarda kirill yozuvida)">
        <F label="F.I.O" span><input className="input" value={form.fio} onChange={set("fio")} /></F>
        <F label="Pasport seriyasi"><input className="input" value={form.pasportSeriya} onChange={set("pasportSeriya")} placeholder="АА" /></F>
        <F label="Pasport raqami"><input className="input" value={form.pasportRaqam} onChange={set("pasportRaqam")} placeholder="7795929" /></F>
        <F label="Kim tomonidan berilgan" span><input className="input" value={form.pasportKimTomonidan} onChange={set("pasportKimTomonidan")} placeholder="Бухоро вилояти Гиждувон тумани ИИБ" /></F>
        <F label="Berilgan sana"><input type="date" className="input" value={form.pasportSanasi} onChange={set("pasportSanasi")} /></F>
        <F label="Manzil"><input className="input" value={form.manzil} onChange={set("manzil")} placeholder="Навоий вилояти Зарафшон шаҳар" /></F>
      </Group>

      <Group title={`Xonadon №${client.apartmentId} — ${apt.entrance}-podyezd, ${apt.floor}-qavat`}>
        <F label="Xonalar soni"><input inputMode="numeric" className="input" value={form.xonalar} onChange={set("xonalar")} /></F>
        <F label="Umumiy maydoni (kv.m)"><input inputMode="decimal" className="input" value={form.umumiyMaydon} onChange={set("umumiyMaydon")} /></F>
        <F label="Yashash maydoni (kv.m)"><input inputMode="decimal" className="input" value={form.yashashMaydon} onChange={set("yashashMaydon")} /></F>
      </Group>

      <div className="rounded-xl border border-slate-200 p-3 text-sm">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Hujjatlarda shunday yoziladi</p>
        <p><span className="text-slate-500">Bayonnomada:</span> … {client.apartmentId}-хонадонини {moneyWithWords(client.totalPrice)} сумга <b>{dative(form.fio)}</b> …</p>
        <p><span className="text-slate-500">Imzo:</span> ХАРИДОР ___________ <b>{signatureName(form.fio)}</b></p>
      </div>

      {client.remaining > 0 && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <b>Diqqat:</b> mijozda <b>{fmtMoney(client.remaining)}</b> to'lanmagan qoldiq bor (to'langan: {fmtMoney(client.paid)}).
          To'plamdagi "qarzdorligi mavjud emas" ma'lumotnomasi haqiqatga to'g'ri kelmaydi — to'lovlar to'liq kiritilganini tekshiring.
        </p>
      )}
      {missing.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">To'ldirilmagan: {missing.join(", ")}.</p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>Bekor qilish</button>
        <button className="btn-primary" onClick={generate} disabled={busy || missing.length > 0}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Tayyorlash va yuklab olish (.docx)
        </button>
      </div>
    </div>
  );
}

const Group = ({ title, children }) => (
  <fieldset>
    <legend className="mb-2 text-sm font-semibold text-slate-900">{title}</legend>
    <div className="grid gap-3 sm:grid-cols-2">{children}</div>
  </fieldset>
);

const F = ({ label, span, children }) => (
  <div className={span ? "sm:col-span-2" : ""}>
    <label className="label">{label}</label>
    {children}
  </div>
);
