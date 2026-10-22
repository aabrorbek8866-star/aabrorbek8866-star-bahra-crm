import { Bot, X, Minus } from "lucide-react";
import { useAgents } from "./AgentContext";
import { AGENT_LIST, AGENTS } from "./agents";
import AgentChat from "./AgentChat";

/**
 * Pastki o'ng burchakdagi AI dok: yopiq holatda 3 ta agent tugmasi,
 * ochiq holatda — tablar bilan chat paneli (mobil qurilmada to'liq ekran).
 */
export default function AgentDock() {
  const { isOpen, setOpen, active, setActive, busy, open } = useAgents();

  if (!isOpen) {
    return (
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 shadow-xl">
        <span className="hidden items-center gap-1.5 pl-3 pr-1 text-xs font-semibold text-slate-500 sm:flex"><Bot size={15} /> AI yordamchilar</span>
        {AGENT_LIST.map((a) => (
          <button
            key={a.id}
            onClick={() => open(a.id)}
            title={`${a.name} — ${a.role}`}
            className={`relative grid h-11 w-11 place-items-center rounded-full text-white transition hover:scale-105 ${a.accent}`}
          >
            <a.icon size={19} />
            {busy[a.id] && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-sky-400" />}
          </button>
        ))}
      </div>
    );
  }

  const agent = AGENTS[active];
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white shadow-2xl sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(720px,calc(100vh-40px))] sm:w-[440px] sm:rounded-2xl sm:border sm:border-slate-200">
      <div className="flex items-center gap-1 border-b border-slate-100 p-2">
        {AGENT_LIST.map((a) => (
          <button
            key={a.id}
            onClick={() => setActive(a.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${
              active === a.id ? `${a.accent} text-white` : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <a.icon size={14} /> {a.name.replace("AI ", "")}
            {busy[a.id] && active !== a.id && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />}
          </button>
        ))}
        <button className="ml-1 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setOpen(false)} title="Kichraytirish">
          <span className="hidden sm:inline"><Minus size={16} /></span>
          <span className="sm:hidden"><X size={18} /></span>
        </button>
      </div>
      <AgentChat key={agent.id} agent={agent} />
    </div>
  );
}
