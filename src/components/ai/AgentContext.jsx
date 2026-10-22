import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useCrm } from "../../store/CrmContext";
import { useAuth } from "../../store/AuthContext";
import { buildAiContext } from "../../services/aiContext";
import { streamAgentChat } from "../../services/api";

const AgentCtx = createContext(null);

const loadHistories = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? { ceo: [], cfo: [], lawyer: [] };
  } catch {
    return { ceo: [], cfo: [], lawyer: [] };
  }
};

/**
 * AI agentlar holati: panel ochiq/yopiq, faol agent, har bir agentning alohida suhbat tarixi.
 * Suhbat oqimi (streaming) shu yerda boshqariladi — panel yopilsa ham javob yozilishda davom etadi.
 */
export function AgentProvider({ children }) {
  const crm = useCrm();
  const { user } = useAuth();
  const historyKey = `bahra-ai-chats-v1:${user.id}`;
  const crmRef = useRef(crm);
  crmRef.current = crm;

  const [isOpen, setOpen] = useState(false);
  const [active, setActive] = useState("ceo");
  const [histories, setHistories] = useState(() => loadHistories(historyKey));
  const historiesRef = useRef(histories);
  historiesRef.current = histories;
  const [busy, setBusy] = useState({});
  const controllers = useRef({});

  useEffect(() => {
    // Yozilayotgan (pending) xabarlarni saqlamaymiz
    const clean = Object.fromEntries(Object.entries(histories).map(([k, v]) => [k, v.filter((m) => !m.pending)]));
    try { localStorage.setItem(historyKey, JSON.stringify(clean)); } catch { /* joy yetmasa — e'tiborsiz */ }
  }, [histories, historyKey]);

  const patchLast = (agent, fn) =>
    setHistories((h) => {
      const list = [...h[agent]];
      list[list.length - 1] = fn(list[list.length - 1]);
      return { ...h, [agent]: list };
    });

  const send = useCallback(async (agent, text) => {
    const content = text.trim();
    if (!content || controllers.current[agent]) return;

    const history = [...historiesRef.current[agent], { role: "user", content, at: Date.now() }];
    setHistories((h) => ({
      ...h,
      [agent]: [...history, { role: "assistant", content: "", pending: true, at: Date.now() }],
    }));

    const controller = new AbortController();
    controllers.current[agent] = controller;
    setBusy((b) => ({ ...b, [agent]: true }));

    try {
      await streamAgentChat({
        agent,
        messages: history.map(({ role, content }) => ({ role, content })),
        context: buildAiContext(crmRef.current, agent),
        signal: controller.signal,
        onDelta: (delta) => patchLast(agent, (m) => ({ ...m, content: m.content + delta })),
      });
    } catch (e) {
      if (e.name !== "AbortError") {
        patchLast(agent, (m) => ({ ...m, content: `${m.content}\n\n⚠️ Server bilan aloqa yo'q: ${e.message}`, error: true }));
      }
    } finally {
      patchLast(agent, (m) => ({ ...m, pending: false, content: m.content || "_(javob to'xtatildi)_" }));
      delete controllers.current[agent];
      setBusy((b) => ({ ...b, [agent]: false }));
    }
  }, []);

  const stop = useCallback((agent) => controllers.current[agent]?.abort(), []);
  const clear = useCallback((agent) => {
    controllers.current[agent]?.abort();
    setHistories((h) => ({ ...h, [agent]: [] }));
  }, []);

  /** Agentni ochish; prompt berilsa, darhol yuboriladi (masalan, "Ogohlantirish xati" tugmasidan). */
  const open = useCallback((agent = "ceo", prompt) => {
    setActive(agent);
    setOpen(true);
    if (prompt) send(agent, prompt);
  }, [send]);

  const value = useMemo(
    () => ({ isOpen, setOpen, active, setActive, histories, busy, send, stop, clear, open }),
    [isOpen, active, histories, busy, send, stop, clear, open],
  );
  return <AgentCtx.Provider value={value}>{children}</AgentCtx.Provider>;
}

export const useAgents = () => {
  const ctx = useContext(AgentCtx);
  if (!ctx) throw new Error("useAgents AgentProvider ichida ishlatilishi kerak");
  return ctx;
};
