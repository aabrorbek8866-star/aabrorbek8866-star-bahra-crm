// Google Gemini API (REST, oqimli) — bepul tarif uchun muqobil AI provayder.
// Bepul tarifda Google so'rovlardan o'z mahsulotlarini yaxshilashda foydalanishi mumkin,
// shuning uchun bu provayderga mijoz ismlari va telefonlari yuborilmaydi (anonymize.js).

const BASE = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
// Nusxalashda qo'shilib qolgan bo'shliq, qo'shtirnoq yoki yangi qatorlarni olib tashlash
const key = () => String(process.env.GEMINI_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");

export class GeminiError extends Error {
  constructor(status, reason, message) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

async function call(path, init = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key(), ...(init.headers ?? {}) },
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    // Tarmoq darajasidagi xato (DNS, TLS, ulanish) — sababini ko'rsatamiz
    throw new GeminiError(0, "NETWORK", `${e.message}${e.cause ? `: ${e.cause.code ?? ""} ${e.cause.message ?? ""}` : ""}`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const reason = body?.error?.details?.find((d) => d.reason)?.reason ?? body?.error?.status ?? "";
    throw new GeminiError(res.status, reason, body?.error?.message ?? `Gemini xatosi (${res.status})`);
  }
  return res;
}

// ---------- Model tanlash ----------
// Bepul tarifdagi modellar vaqti-vaqti bilan o'zgaradi, shuning uchun nom qattiq yozilmaydi:
// GEMINI_MODEL berilmasa, ro'yxatdan generateContent'ni qo'llaydigan eng yangi "flash" modellari olinadi.

let candidates = null;
let working = null;

const version = (name) => Number((name.match(/gemini-(\d+(?:\.\d+)?)/) ?? [])[1] ?? 0);

async function modelCandidates() {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL];
  if (candidates) return candidates;
  const res = await call("/models?pageSize=200");
  const { models = [] } = await res.json();
  const usable = models
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => /^gemini-[\d.]+-flash(-lite)?(-latest|-\d{3})?$/.test(n) || /^gemini-flash(-lite)?-latest$/.test(n));
  // Avval oddiy flash (sifatliroq), keyin flash-lite; har birida eng yangi versiya
  usable.sort((a, b) => Number(a.includes("lite")) - Number(b.includes("lite")) || version(b) - version(a));
  candidates = usable.length ? usable : ["gemini-flash-latest", "gemini-flash-lite-latest"];
  return candidates;
}

/** Bu xato boshqa model bilan qayta urinishga arziydimi (model yo'q / bepul tarifda ruxsat etilmagan). */
const tryNextModel = (e) => e instanceof GeminiError && (e.status === 404 || (e.status === 429 && /limit:\s*0\b/.test(e.message)));

// ---------- Oqimli javob ----------

/**
 * @param {{ system: string, messages: {role: "user"|"assistant", content: string}[], signal: AbortSignal, onText: (t: string) => void }} p
 * @returns {Promise<{ model: string, finishReason: string }>}
 */
export async function streamGemini({ system, messages, signal, onText }) {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: 8192, temperature: 0.4 },
  });

  const list = working ? [working, ...(await modelCandidates()).filter((m) => m !== working)] : await modelCandidates();
  let lastError;
  for (const model of list) {
    let res;
    try {
      res = await call(`/models/${model}:streamGenerateContent?alt=sse`, { method: "POST", body, signal });
    } catch (e) {
      lastError = e;
      if (tryNextModel(e)) continue;
      throw e;
    }
    working = model;
    return { model, finishReason: await readSse(res, onText) };
  }
  throw lastError ?? new GeminiError(404, "NO_MODEL", "Mos Gemini modeli topilmadi");
}

/** SSE oqimini o'qish: har bir "data: {...}" qatoridan matn qismlari (fikrlash qismlari tashlab yuboriladi). */
async function readSse(res, onText) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finishReason = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      let chunk;
      try {
        chunk = JSON.parse(line.slice(5));
      } catch {
        continue;
      }
      const cand = chunk.candidates?.[0];
      for (const part of cand?.content?.parts ?? []) {
        if (part.text && !part.thought) onText(part.text);
      }
      if (cand?.finishReason) finishReason = cand.finishReason;
      if (chunk.promptFeedback?.blockReason) finishReason = "BLOCKED";
    }
  }
  return finishReason;
}

export const geminiConfigured = () => Boolean(key());

/** Diagnostika: kalit ishlaydimi va qaysi modellar mavjud. */
export async function diagnoseGemini() {
  candidates = null; // ro'yxatni yangidan olish
  const list = await modelCandidates();
  return { keyLength: key().length, keyPrefix: key().slice(0, 4), models: list.slice(0, 8), working };
}
