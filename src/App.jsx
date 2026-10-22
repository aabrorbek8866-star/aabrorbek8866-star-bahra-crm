import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "./store/AuthContext";
import { CrmProvider } from "./store/CrmContext";
import { AgentProvider } from "./components/ai/AgentContext";
import Layout from "./components/layout/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Apartments from "./pages/Apartments";
import Clients from "./pages/Clients";
import ClientProfile from "./pages/ClientProfile";
import Debtors from "./pages/Debtors";
import ImportPage from "./pages/ImportPage";
import Users from "./pages/Users";
import AuditLog from "./pages/AuditLog";

export default function App() {
  const { user, checking, can } = useAuth();

  if (checking) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-brand-600" size={32} /></div>;
  }
  if (!user) return <Login />;

  // key: boshqa xodim kirganda holat va AI suhbatlar tozadan yuklanadi
  return (
    <CrmProvider key={user.id}>
      <AgentProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="xonadonlar" element={<Apartments />} />
            <Route path="mijozlar" element={<Clients />} />
            <Route path="mijozlar/:id" element={<ClientProfile />} />
            <Route path="qarzdorlar" element={<Debtors />} />
            {can("import") && <Route path="import" element={<ImportPage />} />}
            {can("users:manage") && <Route path="xodimlar" element={<Users />} />}
            {can("audit:view") && <Route path="jurnal" element={<AuditLog />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AgentProvider>
    </CrmProvider>
  );
}
