import { useNavigate } from "react-router-dom";
import { useCrm } from "../store/CrmContext";
import { BUILDING } from "../data/schema";
import { PageHeader } from "../components/ui";
import { fmtShort } from "../utils/format";

// "Shaxmatka" ko'rinishi: har podyezd uchun 7 qavat × 4 xonadon
export default function Apartments() {
  const { apartments, clientById } = useCrm();
  const navigate = useNavigate();
  const sold = apartments.filter((a) => a.status === "sold").length;

  return (
    <>
      <PageHeader title="Xonadonlar shaxmatkasi" subtitle={`${sold} ta sotilgan · ${apartments.length - sold} ta bo'sh`} />
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-600">
        <Legend cls="bg-emerald-500" label="Sotilgan, to'lov o'z vaqtida" />
        <Legend cls="bg-red-500" label="Sotilgan, qarzdor" />
        <Legend cls="bg-white border border-slate-300" label="Bo'sh" />
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
                            disabled={!c}
                            onClick={() => c && navigate(`/mijozlar/${c.id}`)}
                            title={c ? `${c.fullName}\nTo'langan: ${c.progress.toFixed(0)}%` : "Bo'sh xonadon"}
                            className={`rounded-lg px-2 py-2 text-left transition disabled:cursor-default ${cls}`}
                          >
                            <div className="flex items-baseline justify-between">
                              <span className="text-sm font-bold">№{a.id}</span>
                              <span className="text-[10px] opacity-80">{a.rooms}x</span>
                            </div>
                            <div className="text-[10px] opacity-80">{a.area} m²</div>
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
    </>
  );
}

const Legend = ({ cls, label }) => (
  <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${cls}`} />{label}</span>
);
