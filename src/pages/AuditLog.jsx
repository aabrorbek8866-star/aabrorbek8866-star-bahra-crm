import { useEffect, useState } from "react";
import { api } from "../services/api";
import { PageHeader, Badge } from "../components/ui";
import { fmtMoney } from "../utils/format";

const ACTIONS = {
  create: { label: "Qo'shildi", cls: "bg-emerald-100 text-emerald-800" },
  update: { label: "O'zgartirildi", cls: "bg-amber-100 text-amber-800" },
  delete: { label: "O'chirildi", cls: "bg-red-100 text-red-800" },
  import: { label: "Import", cls: "bg-brand-100 text-brand-800" },
  upload_contract: { label: "PDF yuklandi", cls: "bg-violet-100 text-violet-800" },
  send: { label: "Yuborildi", cls: "bg-sky-100 text-sky-800" },
  login: { label: "Kirdi", cls: "bg-slate-100 text-slate-600" },
  password_change: { label: "Parol o'zgardi", cls: "bg-slate-100 text-slate-600" },
};
const ENTITIES = { apartment: "Xonadon", payment: "To'lov", client: "Mijoz", user: "Xodim", excel: "Excel", sms: "SMS" };

function describe(e) {
  const d = e.details ?? {};
  if (e.entity === "payment" && e.action === "update") {
    return Object.keys(d.after ?? {}).map((k) => `${k}: ${fmt(k, d.before?.[k])} → ${fmt(k, d.after[k])}`).join("; ");
  }
  if (e.entity === "payment" && e.action === "import") return `Mijoz #${e.entityId}: ${d.inserted} ta to'lov Excel'dan qo'shildi`;
  if (e.entity === "payment") return `${fmtMoney(d.amount)} · ${d.date} · ${d.comment ?? ""}`;
  if (e.entity === "excel") return `${d.mode === "replace" ? "To'liq almashtirish" : "Yangilash"}: ${d.clients} mijoz, ${d.inserted} yangi to'lov`;
  if (e.entity === "sms") return `${d.ok} / ${d.count} ta yuborildi`;
  if (e.entity === "client" && e.action === "update") {
    return `${d.name}: ${Object.entries(d.changed ?? {}).map(([k, v]) => `${k}: ${v.from ?? "—"} → ${v.to}`).join("; ") || "o'zgarish yo'q"}`;
  }
  if (e.entity === "client" && e.action !== "upload_contract") return `№${d.apartmentId} · ${d.name} · shartnoma ${d.contract}`;
  if (e.entity === "client") return d.name ?? "";
  if (e.entity === "apartment") return `${d.rooms} xona, ${d.area} m² → №${(d.ids ?? []).join(", ")}`;
  if (e.entity === "user") return [d.login, d.role, d.active === false && "o'chirildi", d.passwordReset && "parol yangilandi"].filter(Boolean).join(" · ");
  return "";
}
const fmt = (k, v) => (k === "amount" ? fmtMoney(v) : v);

/** Kim, qachon, nima qildi — moliyaviy nazorat uchun. */
export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { api("/audit?limit=300").then(setRows).catch((e) => setError(e.message)); }, []);

  return (
    <>
      <PageHeader title="Amallar jurnali" subtitle="So'nggi 300 ta amal: to'lovlar, importlar, SMS, xodimlar" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr><th className="th">Vaqt</th><th className="th">Xodim</th><th className="th">Amal</th><th className="th">Tafsilot</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((e) => {
              const a = ACTIONS[e.action] ?? { label: e.action, cls: "bg-slate-100" };
              return (
                <tr key={e.id}>
                  <td className="td whitespace-nowrap text-xs">{new Date(e.at).toLocaleString("ru-RU")}</td>
                  <td className="td whitespace-nowrap">{e.user ?? "—"}</td>
                  <td className="td whitespace-nowrap"><Badge className={a.cls}>{ENTITIES[e.entity] ?? e.entity}: {a.label}</Badge></td>
                  <td className="td max-w-md truncate text-slate-500" title={describe(e)}>{describe(e)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
