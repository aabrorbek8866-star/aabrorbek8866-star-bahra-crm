import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Square, Trash2, Copy, Check, Loader2 } from "lucide-react";
import { useAgents } from "./AgentContext";

/**
 * Bitta agent bilan muloqot oynasi: xabarlar tarixi, tayyor savollar, oqimli (streaming) javob.
 * @param {{ agent: import("./agents").AGENTS["ceo"] }} props
 */
export default function AgentChat({ agent }) {
  const { histories, busy, send, stop, clear, info } = useAgents();
  const providerLabel = { anthropic: "Claude", gemini: "Gemini (bepul) · ismlar yuborilmaydi", none: "AI kaliti o'rnatilmagan" }[info?.provider];
  const messages = histories[agent.id];
  const isBusy = !!busy[agent.id];
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => inputRef.current?.focus(), [agent.id]);

  const submit = (text = input) => {
    if (!text.trim() || isBusy) return;
    send(agent.id, text);
    setInput("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`grid h-10 w-10 place-items-center rounded-xl text-white ${agent.accent}`}><agent.icon size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{agent.name}</p>
          <p className="truncate text-xs text-slate-500">{agent.role} · CRM ma'lumotlariga ulangan</p>
          {providerLabel && (
            <p className={`truncate text-[11px] ${info.provider === "none" ? "text-red-600" : info.anonymized ? "text-emerald-700" : "text-slate-400"}`}>
              {info.anonymized ? "🔒 " : ""}{providerLabel}
            </p>
          )}
        </div>
        {messages.length > 0 && (
          <button onClick={() => clear(agent.id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600" title="Suhbatni tozalash">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 px-4 py-4">
        {messages.length === 0 ? (
          <div>
            <div className={`rounded-2xl bg-white p-4 text-sm text-slate-600 ring-1 ${agent.ring}`}>{agent.intro}</div>
            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Tayyor savollar</p>
            <div className="space-y-2">
              {agent.suggestions.map((s) => (
                <button key={s} onClick={() => submit(s)} className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => <Message key={i} m={m} agent={agent} />)
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={`${agent.name}ga savol yozing...`}
            className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
          />
          {isBusy ? (
            <button type="button" onClick={() => stop(agent.id)} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-800 text-white" title="To'xtatish">
              <Square size={14} />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className={`grid h-9 w-9 place-items-center rounded-lg text-white disabled:opacity-40 ${agent.accent}`} title="Yuborish">
              <Send size={15} />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-center text-[10px] text-slate-400">AI tavsiyalari yordamchi xarakterda — muhim qarorlarni mutaxassis bilan tekshiring.</p>
      </form>
    </div>
  );
}

function Message({ m, agent }) {
  const [copied, setCopied] = useState(false);
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-slate-800 px-3.5 py-2.5 text-sm text-white">{m.content}</div>
      </div>
    );
  }
  const copy = async () => {
    await navigator.clipboard.writeText(m.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex gap-2">
      <span className={`mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white ${agent.accent}`}><agent.icon size={14} /></span>
      <div className={`group min-w-0 max-w-[90%] rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-sm text-slate-700 ring-1 ${m.error ? "ring-red-200" : "ring-slate-200"}`}>
        {m.content ? (
          <div className="prose-chat break-words"><ReactMarkdown>{m.content}</ReactMarkdown></div>
        ) : (
          <span className="inline-flex items-center gap-2 text-slate-400"><Loader2 size={14} className="animate-spin" /> Ma'lumotlar tahlil qilinmoqda...</span>
        )}
        {!m.pending && m.content && (
          <button onClick={copy} className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-400 opacity-0 transition hover:text-slate-700 group-hover:opacity-100">
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Nusxalandi" : "Nusxalash"}
          </button>
        )}
      </div>
    </div>
  );
}
