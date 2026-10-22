import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Loader2, Menu, RefreshCw } from "lucide-react";
import Sidebar from "./Sidebar";
import AgentDock from "../ai/AgentDock";
import { useCrm } from "../../store/CrmContext";
import { useAuth } from "../../store/AuthContext";

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { status, error, reload } = useCrm();
  const { can } = useAuth();

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button className="btn-secondary px-2" onClick={() => setMobileOpen(true)} aria-label="Menyu">
            <Menu size={18} />
          </button>
          <span className="font-semibold">Bahra Building</span>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 pb-28 md:p-6 md:pb-28">
          {status === "loading" && (
            <div className="grid h-64 place-items-center text-slate-500">
              <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Ma'lumotlar yuklanmoqda...</span>
            </div>
          )}
          {status === "error" && (
            <div className="card mx-auto mt-10 max-w-md p-6 text-center">
              <p className="font-semibold text-slate-900">Server bilan aloqa yo'q</p>
              <p className="mt-1 text-sm text-slate-500">{error}</p>
              <button className="btn-primary mt-4" onClick={reload}><RefreshCw size={16} /> Qayta urinish</button>
            </div>
          )}
          {status === "ready" && <Outlet />}
        </main>
      </div>
      {status === "ready" && can("ai:use") && <AgentDock />}
    </div>
  );
}
