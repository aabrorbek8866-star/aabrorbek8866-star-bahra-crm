import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Phone, IdCard, FileSignature, CalendarClock, Home, Scale, Pencil, FileSpreadsheet, Download } from "lucide-react";
import { useCrm } from "../store/CrmContext";
import { PageHeader, Modal, ProgressBar, Badge, EmptyState } from "../components/ui";
import PaymentForm from "../components/payments/PaymentForm";
import PaymentList from "../components/payments/PaymentList";
import ContractUpload from "../components/clients/ContractUpload";
import ClientForm from "../components/clients/ClientForm";
import PaymentScheduleImport from "../components/payments/PaymentScheduleImport";
import { downloadPaymentSchedule } from "../utils/excel";
import { useAgents } from "../components/ai/AgentContext";
import { useAuth } from "../store/AuthContext";
import { fmtDate, fmtMoney } from "../utils/format";

export default function ClientProfile() {
  const { id } = useParams();
  const { clientById, payments, addPayment, updatePayment, deletePayment, replaceClient, updateClient, deleteClient, importClientPayments } = useCrm();
  const navigate = useNavigate();
  const { open } = useAgents();
  const { can } = useAuth();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);
  const client = clientById.get(Number(id));

  if (!client) {
    return <EmptyState title="Mijoz topilmadi" action={<Link to="/mijozlar" className="btn-secondary">Mijozlar ro'yxatiga</Link>} />;
  }

  const own = payments.filter((p) => p.clientId === client.id);
  const apt = client.apartment;

  return (
    <>
      <Link to="/mijozlar" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={16} /> Mijozlar</Link>
      <PageHeader
        title={client.fullName}
        subtitle={`Shartnoma № ${client.contractNumber} · ${fmtDate(client.contractDate)} dan beri mijoz`}
        actions={
          <>
            {client.isDebtor && can("ai:use") && (
              <button
                className="btn-secondary"
                onClick={() => open("lawyer", `${client.fullName} (${client.apartmentId}-xonadon, shartnoma ${client.contractNumber}) uchun qarzdorlik bo'yicha rasmiy ogohlantirish (pretenziya) xatini tayyorlang. Qarz: ${fmtMoney(client.debt)}, kechikish: ${client.overdueDays} kun.`)}
              >
                <Scale size={16} /> Ogohlantirish xati (AI Yurist)
              </button>
            )}
            {can("clients:edit") && (
              <button className="btn-secondary" onClick={() => setEditing(true)}><Pencil size={16} /> Tahrirlash</button>
            )}
            <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> To'lov qo'shish</button>
          </>
        }
      />

      {client.isDebtor && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <b>Qarzdor:</b> {fmtMoney(client.debt)} muddati o'tgan · {client.overdueDays} kun kechikish. Grafik bo'yicha shu kungacha {fmtMoney(client.expected)} to'lanishi kerak edi.
        </div>
      )}

      {!client.hasSchedule && client.remaining > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>To'lov grafigi kiritilmagan</b> — muddati o'tgan qarzni hisoblab bo'lmaydi.
          {client.stale && <> Oxirgi to'lovdan beri <b>{client.daysSinceLastPayment} kun</b> o'tdi.</>}
          {can("clients:edit") && <> <button className="font-semibold underline" onClick={() => setEditing(true)}>Boshlang'ich va oylik to'lovni kiritish</button></>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Mijoz ma'lumotlari</h2>
              {can("clients:edit") && (
                <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Tahrirlash" onClick={() => setEditing(true)}><Pencil size={15} /></button>
              )}
            </div>
            <dl className="space-y-3 text-sm">
              <Row icon={Phone} label="Telefon" value={<a className="text-brand-700 hover:underline" href={`tel:${client.phone.replace(/\s|-/g, "")}`}>{client.phone || "—"}</a>} />
              <Row icon={IdCard} label="Pasport" value={client.passport || "—"} />
              <Row icon={FileSignature} label="Shartnoma" value={`${client.contractNumber} (${fmtDate(client.contractDate)})`} />
              <Row icon={CalendarClock} label="Oxirgi to'lov" value={fmtDate(client.lastPaymentDate)} />
              <Row icon={Home} label="Xonadon" value={apt ? <>
                №{apt.id} · {apt.entrance}-podyezd, {apt.floor}-qavat{apt.rooms ? ` · ${apt.rooms} xona` : ""}
                <span className="block text-xs text-slate-500">
                  {apt.area ? `${apt.area} m²` : "maydon kiritilmagan"}
                  {apt.totalArea ? ` · umumiy ${apt.totalArea} m²` : ""}{apt.livingArea ? ` · yashash ${apt.livingArea} m²` : ""}
                </span>
              </> : "—"} />
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Moliyaviy holat</h2>
            <ProgressBar value={client.progress} tone={client.isDebtor ? "bg-red-500" : "bg-emerald-500"} />
            <p className="mt-1 text-xs text-slate-500">{client.progress.toFixed(1)}% to'langan</p>
            <dl className="mt-4 space-y-2 text-sm">
              <Money label="Shartnoma summasi" v={client.totalPrice} />
              {client.hasSchedule && <Money label="Boshlang'ich to'lov" v={client.downPayment} />}
              {client.hasSchedule && <Money label="Oylik to'lov" v={client.monthlyPayment} hint={`${client.installmentMonths} oy`} />}
              <Money label="To'langan" v={client.paid} cls="text-emerald-700" />
              <Money label="Qolgan" v={client.remaining} />
              {client.debt > 0 && <Money label="Muddati o'tgan qarz" v={client.debt} cls="text-red-600" />}
            </dl>
            {client.nextDue && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                Keyingi to'lov: <b>{fmtDate(client.nextDue.date)}</b> — {fmtMoney(client.nextDue.amount)}
              </div>
            )}
          </div>

          <ContractUpload client={client} canUpload={can("contracts:upload")} onUploaded={replaceClient} />
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">To'lovlar tarixi</h2>
            <div className="flex items-center gap-2">
              <Badge className="bg-slate-100 text-slate-700">{own.length} ta to'lov</Badge>
              <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => downloadPaymentSchedule(client, own)} title="Excel'ga yuklab olish">
                <Download size={14} /> Excel
              </button>
              {can("clients:edit") && (
                <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => setImporting(true)}>
                  <FileSpreadsheet size={14} /> Excel'dan yuklash
                </button>
              )}
            </div>
          </div>
          <PaymentList
            payments={own}
            onUpdate={can("payments:update") ? updatePayment : null}
            onDelete={can("payments:delete") ? deletePayment : null}
          />
        </div>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title={`Yangi to'lov — ${client.fullName}`}>
        <PaymentForm
          defaultAmount={client.isDebtor ? String(client.debt) : client.monthlyPayment ? String(client.monthlyPayment) : ""}
          onCancel={() => setAdding(false)}
          onSubmit={async (p) => { await addPayment({ ...p, clientId: client.id }); setAdding(false); }}
        />
      </Modal>

      <Modal open={editing} onClose={() => setEditing(false)} title={`№${client.apartmentId} xonadon — mijoz ma'lumotlari`} wide>
        {editing && (
          <ClientForm
            client={client}
            onCancel={() => setEditing(false)}
            onSubmit={async (data) => { await updateClient(client.id, data); setEditing(false); }}
            onDelete={can("clients:delete") ? async () => { await deleteClient(client.id); navigate("/xonadonlar"); } : null}
          />
        )}
      </Modal>

      <Modal open={importing} onClose={() => setImporting(false)} title={`To'lov jadvalini yuklash — ${client.fullName}`} wide>
        {importing && (
          <PaymentScheduleImport client={client} onImport={(body) => importClientPayments(client.id, body)} onClose={() => setImporting(false)} />
        )}
      </Modal>
    </>
  );
}

const Row = ({ icon: Icon, label, value }) => (
  <div className="flex gap-3">
    <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" />
    <div><dt className="text-xs text-slate-500">{label}</dt><dd className="text-slate-800">{value}</dd></div>
  </div>
);

const Money = ({ label, v, hint, cls = "text-slate-900" }) => (
  <div className="flex justify-between gap-2">
    <dt className="text-slate-500">{label}{hint && <span className="text-xs text-slate-400"> ({hint})</span>}</dt>
    <dd className={`font-medium ${cls}`}>{fmtMoney(v)}</dd>
  </div>
);
