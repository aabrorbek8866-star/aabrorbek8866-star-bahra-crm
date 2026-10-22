import { NavLink } from "react-router-dom";
import { LayoutDashboard, Building2, Users, AlertTriangle, FileSpreadsheet, X, Bot, UserCog, ScrollText, LogOut } from "lucide-react";
import { useCrm } from "../../store/CrmContext";
import { useAuth } from "../../store/AuthContext";
import { useAgents } from "../ai/AgentContext";
import { AGENT_LIST } from "../ai/agents";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/xonadonlar", label: "Xonadonlar", icon: Building2 },
  { to: "/mijozlar", label: "Mijozlar", icon: Users },
  { to: "/qarzdorlar", label: "Qarzdorlar", icon: AlertTriangle, badge: "debtors" },
  { to: "/import", label: "Excel import", icon: FileSpreadsheet, perm: "import" },
  { to: "/xodimlar", label: "Xodimlar", icon: UserCog, perm: "users:manage" },
  { to: "/jurnal", label: "Amallar jurnali", icon: ScrollText, perm: "audit:view" },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const { debtors } = useCrm();
  const { user, can, logout } = useAuth();
  const { open } = useAgents();

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto bg-slate-900 text-slate-300 transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 font-bold text-white">B</div>
            <div>
              <p className="text-sm font-semibold text-white">Bahra Building</p>
              <p className="text-[11px] text-slate-400">Sotuv va to'lovlar CRM</p>
            </div>
          </div>
          <button className="lg:hidden" onClick={onClose} aria-label="Yopish"><X size={18} /></button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.filter((n) => !n.perm || can(n.perm)).map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {badge === "debtors" && debtors.length > 0 && (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">{debtors.length}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {can("ai:use") && (
          <div className="border-t border-white/10 p-3">
            <p className="mb-2 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Bot size={13} /> AI maslahatchilar
            </p>
            {AGENT_LIST.map((a) => (
              <button
                key={a.id}
                onClick={() => { open(a.id); onClose(); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5 hover:text-white"
              >
                <span className={`grid h-7 w-7 place-items-center rounded-lg ${a.avatar}`}><a.icon size={15} /></span>
                <span>
                  <span className="block font-medium">{a.name}</span>
                  <span className="block text-[11px] text-slate-500">{a.role}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-white/10 p-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white">
            {user.fullName.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.fullName}</p>
            <p className="text-[11px] text-slate-400">{user.roleLabel}</p>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" title="Chiqish">
            <LogOut size={17} />
          </button>
        </div>
      </aside>
    </>
  );
}
