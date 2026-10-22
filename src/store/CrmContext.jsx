import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { calcClientDebt } from "../../shared/debt.js";

const CrmContext = createContext(null);
const EMPTY = { apartments: [], clients: [], payments: [], smsLog: [] };

/**
 * Global CRM holati. Manba — server (PostgreSQL); har bir o'zgarish avval serverga yoziladi,
 * muvaffaqiyatli bo'lsa ekrandagi holat yangilanadi.
 */
export function CrmProvider({ children }) {
  const [state, setState] = useState(EMPTY);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setState(await api("/data"));
      setStatus("ready");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Hosila (derived) ma'lumotlar: har mijozning qarzi, xonadoni, oxirgi to'lov sanasi
  const derived = useMemo(() => {
    const aptById = new Map(state.apartments.map((a) => [a.id, a]));
    const clients = state.clients.map((c) => {
      const debt = calcClientDebt(c, state.payments);
      return { ...c, apartment: aptById.get(c.apartmentId), ...debt, lastPaymentDate: debt.lastPaymentDate ?? c.lastPaymentDate };
    });
    return {
      clients,
      clientById: new Map(clients.map((c) => [c.id, c])),
      debtors: clients.filter((c) => c.isDebtor).sort((a, b) => b.overdueDays - a.overdueDays),
    };
  }, [state]);

  const actions = useMemo(() => ({
    reload,
    addPayment: async (payment) => {
      const saved = await api("/payments", { method: "POST", body: payment });
      setState((s) => ({ ...s, payments: [...s.payments, saved] }));
    },
    updatePayment: async (id, patch) => {
      const saved = await api(`/payments/${id}`, { method: "PATCH", body: patch });
      setState((s) => ({ ...s, payments: s.payments.map((p) => (p.id === id ? saved : p)) }));
    },
    deletePayment: async (id) => {
      await api(`/payments/${id}`, { method: "DELETE" });
      setState((s) => ({ ...s, payments: s.payments.filter((p) => p.id !== id) }));
    },
    replaceClient: (client) =>
      setState((s) => ({ ...s, clients: s.clients.map((c) => (c.id === client.id ? client : c)) })),
    importData: async (payload) => {
      const result = await api("/import", { method: "POST", body: payload });
      await reload();
      return result;
    },
  }), [reload]);

  const value = useMemo(() => ({ ...state, ...derived, ...actions, status, error }), [state, derived, actions, status, error]);
  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export const useCrm = () => {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm CrmProvider ichida ishlatilishi kerak");
  return ctx;
};
