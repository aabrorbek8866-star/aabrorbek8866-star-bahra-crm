// Backend bilan aloqa. Sessiya httpOnly cookie orqali — token JavaScript'ga ko'rinmaydi.

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** 401 bo'lganda AuthContext foydalanuvchini login sahifasiga qaytaradi. */
export const onUnauthorized = { handler: () => {} };

export async function api(path, { method = "GET", body, form } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/auth/login")) onUnauthorized.handler();
  if (!res.ok) throw new ApiError(res.status, data.error || `Server xatosi (${res.status})`, data.details);
  return data;
}

/**
 * AI agent bilan suhbat — javob oqim (stream) ko'rinishida keladi.
 * @param {{ agent: string, messages: {role,content}[], context: object, onDelta: (text) => void, signal?: AbortSignal }} p
 */
export async function streamAgentChat({ agent, messages, context, onDelta, signal }) {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent, messages, context }),
    signal,
  });
  if (res.status === 401) onUnauthorized.handler();
  if (!res.ok && res.headers.get("content-type")?.includes("json")) {
    throw new Error((await res.json()).error);
  }
  if (!res.body) throw new Error("Server javob bermadi");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    onDelta(decoder.decode(value, { stream: true }));
  }
}

export const sendSms = (clientIds, template) => api("/sms/send", { method: "POST", body: { clientIds, template } });

export function uploadContract(clientId, file) {
  const form = new FormData();
  form.append("file", file);
  return api(`/clients/${clientId}/contract`, { method: "POST", form });
}
