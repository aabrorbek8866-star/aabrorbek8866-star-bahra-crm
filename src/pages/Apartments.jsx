import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Loader2 } from "lucide-react";
import { useCrm } from "../store/CrmContext";
import { useAuth } from "../store/AuthContext";
import { BUILDING } from "../data/schema";
import { PageHeader, Modal } from "../components/ui";
import ClientForm from "../components/clients/ClientForm";
import { api } from "../services/api";
import { fmtShort } from "../utils/format";

// "Shaxmatka" ko'rinishi: har podyezd uchun 7 qavat × 4 xonadon
export default function Apartments() {
  const { apartments, clientById, reload, createClient } = useCrm();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selling, setSelling] = useState(null);
  const sold = apartments.filter((a) => a.status === "sold").length;
  const missing = apartments.filter((a) => !a.area).length;

  const onTile = (a, c) => {
    if (editMode) setEditing(a);
    else if (c) navigate(`/mijozlar/${c.id}`);
    else if (can("clients:edit")) setSelling(a);
  };

  return (
    <>
      <PageHeader
        title="Xonadonlar shaxmatkasi"
        subtitle={`${sold} ta sotilgan · ${apartments.length - sold} ta bo'sh${missing ? ` · ${missing} tasining maydoni kiritilmagan` : ""}`}
        actions={can("apartments:edit") && (
          <button className={editMode ? "btn-primary" : "btn-secondary"} onClick={() => setEditMode(!editMode)}>
            <Pencil size={16} /> {editMode ? "Tahrirlashni tugatish" : "Xonadonlarni tahrirlash"}
          </button>
        )}
      />
      {editMode && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
          Tahrirlash rejimi: istalgan xonadonni bosing va xonalar soni hamda maydonini kiriting.
          Bir xil rejali qavatlar uchun "barcha qavatlarga qo'llash" ni tanlang.
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-600">
        <Legend cls="bg-emerald-500" label="Sotilgan, to'lov o'z vaqtida" />
        <Legend cls="bg-red-500" label="Sotilgan, qarzdor" />
        <Legend cls="bg-white border border-slate-300" label={can("clients:edit") ? "Bo'sh — bosing va mijoz qo'shing" : "Bo'sh"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: BUILDING.entrances }, (_, e) => e + 1).map((entrance) => (
          <div key={entrance} className="card p-5">
            <h2 className="mb-4 font-semibold text-slate-900">{entrance}-podyezd</h2>
            <div className="space-y-2">
              {Array.from({ length: BUILDING.floors }, (_, i) => BUILDING.floors - i).map((floor) => (
                <div key={floor} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-xs font-medium text-slate-400">{floor}-qavat</span>
                  <div className="grid flex-1 grid-cols-4 gap-2">
                    {apartments
                      .filter((a) => a.entrance === entrance && a.floor === floor)
                      .sort((a, b) => a.id - b.id)
                      .map((a) => {
                        const c = a.clientId ? clientById.get(a.clientId) : null;
                        const cls = !c
                          ? "border border-dashed border-slate-300 bg-white text-slate-500 hover:border-brand-400"
                          : c.isDebtor
                            ? "bg-red-500 text-white hover:bg-red-600"
                            : "bg-emerald-500 text-white hover:bg-emerald-600";
                        return (
                          <button
                            key={a.id}
                            disabled={!c && !editMode && !can("clients:edit")}
                            onClick={() => onTile(a, c)}
                            title={c ? `${c.fullName}\nTo'langan: ${c.progress.toFixed(0)}%` : "Bo'sh xonadon"}
                            className={`rounded-lg px-2 py-2 text-left transition disabled:cursor-default ${cls} ${editMode ? "ring-2 ring-brand-300 ring-offset-1" : ""}`}
                          >
                            <div className="flex items-baseline justify-between">
                              <span className="text-sm font-bold">№{a.id}</span>
                              <span className="text-[10px] opacity-80">{a.rooms ? `${a.rooms} xona` : "—"}</span>
                            </div>
                            <div className="text-[10px] opacity-80">{a.area ? `${a.area} m²` : "maydon —"}</div>
                            {c && <div className="truncate text-[10px] opacity-90">{c.isDebtor ? `qarz ${fmtShort(c.debt)}` : `${c.progress.toFixed(0)}%`}</div>}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `№${editing.id} xonadon — ${editing.entrance}-podyezd, ${editing.floor}-qavat` : ""}>
        {editing && <ApartmentForm apartment={editing} onDone={async () => { await reload(); setEditing(null); }} />}
      </Modal>

      <Modal open={!!selling} onClose={() => setSelling(null)} title={selling ? `№${selling.id} xonadon — yangi mijoz (sotuv)` : ""} wide>
        {selling && (
          <ClientForm
            onCancel={() => setSelling(null)}
            onSubmit={async (data) => {
              const client = await createClient({ ...data, apartmentId: selling.id });
              setSelling(null);
              navigate(`/mijozlar/${client.id}`);
            }}
          />
        )}
      </Modal>
    </>
  );
}

const num = (v) => Number(String(v ?? "").replace(",", ".")) || 0;

function ApartmentForm({ apartment, onDone }) {
  const [form, setForm] = useState({
    rooms: apartment.rooms ? String(apartment.rooms) : "",
    area: apartment.area ? String(apartment.area) : "",
    totalArea: apartment.totalArea ? String(apartment.totalArea) : "",
    livingArea: apartment.livingArea ? String(apartment.livingArea) : "",
    scope: "entrance",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const position = ((apartment.id - 1) % BUILDING.perFloor) + 1;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/apartments/${apartment.id}`, {
        method: "PATCH",
        body: {
          rooms: Number(form.rooms),
          area: num(form.area),
          totalArea: num(form.totalArea),
          livingArea: num(form.livingArea),
          scope: form.scope,
        },
      });
      await onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const scopes = [
    { id: "one", label: `Faqat №${apartment.id} xonadon` },
    { id: "entrance", label: `${apartment.entrance}-podyezdning barcha 7 qavatida (qavatdagi ${position}-o'rin)` },
    { id: "building", label: `Ikkala podyezdning barcha qavatlarida (${position}-o'rin, 14 ta xonadon)` },
  ];

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="apt-rooms">Xonalar soni</label>
          <input id="apt-rooms" type="number" min="1" max="10" className="input" value={form.rooms} onChange={(e) => setForm({ ...form, rooms: e.target.value })} autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="apt-area">Maydon (m²)</label>
          <input id="apt-area" inputMode="decimal" className="input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="77.8" />
        </div>
        <div>
          <label className="label" htmlFor="apt-total">Umumiy maydoni</label>
          <input id="apt-total" inputMode="decimal" className="input" value={form.totalArea} onChange={(e) => setForm({ ...form, totalArea: e.target.value })} placeholder="69.17" />
        </div>
        <div>
          <label className="label" htmlFor="apt-living">Yashash maydoni</label>
          <input id="apt-living" inputMode="decimal" className="input" value={form.livingArea} onChange={(e) => setForm({ ...form, livingArea: e.target.value })} placeholder="37.97" />
        </div>
      </div>
      <fieldset>
        <legend className="label">Qaysi xonadonlarga qo'llash</legend>
        <div className="space-y-2">
          {scopes.map((s) => (
            <label key={s.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${form.scope === s.id ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}>
              <input type="radio" name="scope" checked={form.scope === s.id} onChange={() => setForm({ ...form, scope: s.id })} />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={busy || !form.rooms || !form.area}>
          {busy && <Loader2 size={16} className="animate-spin" />} Saqlash
        </button>
      </div>
    </form>
  );
}

const Legend = ({ cls, label }) => (
  <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${cls}`} />{label}</span>
);
