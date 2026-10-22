import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { AGENTS } from "../agents/prompts.js";
import { config } from "../config.js";
import { requirePerm } from "../auth/middleware.js";
import { GeminiError, diagnoseGemini, geminiConfigured, streamGemini } from "../ai/gemini.js";
import { anonymizeContext, anonymizeMessages, PRIVACY_NOTE } from "../ai/anonymize.js";

const router = Router();
const client = new Anthropic(); // ANTHROPIC_API_KEY ni muhitdan oladi
const MODEL = config.aiModel;
// Server tomonidagi zaxira model (refusal fallback) faqat shu modellarda bor
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

/**
 * Qaysi AI xizmati ishlatiladi: AI_PROVIDER ("anthropic" | "gemini") yoki qaysi kalit borligiga qarab.
 * Claude kaliti bo'lsa — Claude; faqat Gemini kaliti bo'lsa — Gemini (bepul, ismlarsiz).
 */
function provider() {
  const forced = String(process.env.AI_PROVIDER ?? "").toLowerCase();
  if (forced === "gemini" || forced === "anthropic") return forced;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (geminiConfigured()) return "gemini";
  return "none";
}

/** GET /api/ai/info — chat oynasida qaysi xizmat ishlayotganini ko'rsatish uchun */
router.get("/info", (_req, res) => {
  const p = provider();
  res.json({ provider: p, anonymized: p === "gemini", model: p === "anthropic" ? MODEL : undefined });
});

/** GET /api/ai/diagnose — rahbar uchun: AI kaliti va ulanishni tekshirish (kalitning o'zi ko'rsatilmaydi) */
router.get("/diagnose", requirePerm("users:manage"), async (_req, res) => {
  const p = provider();
  if (p !== "gemini") return res.json({ provider: p, ok: p !== "none" });
  try {
    res.json({ provider: p, ok: true, ...(await diagnoseGemini()) });
  } catch (err) {
    res.json({ provider: p, ok: false, error: explainGemini(err), detail: String(err?.message ?? err).slice(0, 300) });
  }
});

/**
 * POST /api/ai/chat
 * body: { agent: "ceo" | "cfo" | "lawyer", messages: [{role, content}], context: object }
 * Javob: matn oqimi (text/plain, chunked) — frontend uni bo'lakma-bo'lak o'qiydi.
 */
router.post("/chat", requirePerm("ai:use"), async (req, res) => {
  const { agent, messages, context } = req.body ?? {};
  const config = AGENTS[agent];

  if (!config) return res.status(400).json({ error: "Noma'lum agent" });
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages bo'sh" });
  }

  // Faqat user/assistant matnli xabarlarni qabul qilamiz (mijoz tomonidan kelgan tarix)
  const history = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");

  const p = provider();
  if (p === "none") {
    return res.end("⚠️ AI kaliti o'rnatilmagan. Render → bahra-crm → Environment bo'limida GEMINI_API_KEY (bepul) yoki ANTHROPIC_API_KEY ni kiriting.");
  }
  if (p === "gemini") return chatGemini(req, res, config.system, history, context);

  const request = (withFallback) => {
    const params = {
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: [
        // Agent prompti o'zgarmas — keshlanadi
        { type: "text", text: config.system, cache_control: { type: "ephemeral" } },
        {
          type: "text",
          text: `<crm_data generated_at="${new Date().toISOString()}">\n${JSON.stringify(context ?? {}, null, 1)}\n</crm_data>`,
        },
      ],
      messages: history,
    };
    // Xavfsizlik filtri rad etsa, server avtomatik ravishda mos zaxira modelga o'tadi
    return withFallback
      ? client.beta.messages.stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : client.messages.stream(params);
  };

  let stream = null;
  let wrote = false;
  // Foydalanuvchi oynani yopsa yoki "To'xtatish"ni bossa — AI so'rovi ham to'xtatiladi (keraksiz xarajat bo'lmasin)
  res.on("close", () => {
    if (!res.writableEnded) stream?.abort();
  });

  const run = async (withFallback) => {
    stream = request(withFallback);
    stream.on("text", (delta) => {
      wrote = true;
      res.write(delta);
    });
    return stream.finalMessage();
  };

  try {
    let final;
    try {
      final = await run(FALLBACK_MODELS.has(MODEL));
    } catch (err) {
      // Zaxira model sozlamasi qabul qilinmasa (400) — oddiy so'rov bilan qayta urinish
      if (!wrote && err instanceof Anthropic.BadRequestError && /fallback|beta/i.test(err.message)) {
        console.warn("[AI] fallbacks qabul qilinmadi, oddiy so'rov:", err.message);
        final = await run(false);
      } else {
        throw err;
      }
    }
    if (final.stop_reason === "refusal") {
      res.write("\n\n_So'rov xavfsizlik siyosati sababli bajarilmadi. Iltimos, savolni boshqacha ifodalang._");
    } else if (final.stop_reason === "max_tokens") {
      res.write("\n\n_(Javob uzunlik chegarasiga yetdi — davomini so'rang.)_");
    }
    res.end();
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) return res.end();
    console.error("[AI]", err);
    if (!res.headersSent) res.status(500);
    res.end(`\n\n⚠️ ${explain(err)}`);
  }
});

/** Gemini orqali javob: mijoz ismlari va telefonlari yuborilmaydi. */
async function chatGemini(req, res, agentSystem, history, context) {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    const safeContext = anonymizeContext(context ?? {});
    const safeHistory = await anonymizeMessages(history);
    const system = `${agentSystem}\n${PRIVACY_NOTE}\n\n<crm_data generated_at="${new Date().toISOString()}">\n${JSON.stringify(safeContext, null, 1)}\n</crm_data>`;
    const { finishReason } = await streamGemini({ system, messages: safeHistory, signal: controller.signal, onText: (t) => res.write(t) });
    if (finishReason === "MAX_TOKENS") res.write("\n\n_(Javob uzunlik chegarasiga yetdi — davomini so'rang.)_");
    else if (finishReason === "SAFETY" || finishReason === "BLOCKED") res.write("\n\n_So'rov xavfsizlik filtri sababli bajarilmadi. Savolni boshqacha ifodalang._");
    res.end();
  } catch (err) {
    if (err.name === "AbortError") return res.end();
    console.error("[AI/Gemini]", err?.status, err?.reason, err?.message, err?.stack);
    res.end(`\n\n⚠️ ${explainGemini(err)}`);
  }
}

function explainGemini(err) {
  if (!(err instanceof GeminiError)) return `Serverdagi xato: ${String(err?.message ?? err).slice(0, 200)}`;
  if (err.reason === "NETWORK") return `Gemini serveriga ulanib bo'lmadi (${err.message.slice(0, 160)}).`;
  if (/location is not supported|User location/i.test(err.message)) return "Google Gemini bu server joylashgan hududda ishlamaydi.";
  if (err.reason === "API_KEY_INVALID" || err.status === 401) return "Gemini kaliti noto'g'ri. Render → Environment → GEMINI_API_KEY ni tekshiring.";
  if (err.status === 429) return "Gemini bepul limiti tugadi (daqiqalik yoki kunlik). Birozdan so'ng yoki ertaga urinib ko'ring.";
  if (err.status === 403) return "Bu Gemini kalitiga ruxsat yo'q (hudud yoki loyiha cheklovi).";
  if (err.status === 404) return "Mos Gemini modeli topilmadi. Render'da GEMINI_MODEL ni bo'sh qoldiring yoki to'g'ri nom kiriting.";
  if (err.status >= 500) return "Gemini xizmati hozir band, birozdan so'ng urinib ko'ring.";
  return `Gemini xatosi (${err.status}): ${err.message.slice(0, 200)}`;
}

/** Xatoni foydalanuvchi tushunadigan tilda tushuntirish. */
function explain(err) {
  const text = String(err?.message ?? "");
  if (err instanceof Anthropic.AuthenticationError || /authentication method|api.?key/i.test(text)) {
    return "AI kaliti noto'g'ri yoki o'rnatilmagan. Render → bahra-crm → Environment bo'limida ANTHROPIC_API_KEY ni tekshiring.";
  }
  if (/credit balance|billing|purchase credits/i.test(text)) {
    return "Anthropic hisobida mablag' qolmagan. console.anthropic.com → Billing bo'limida hisobni to'ldiring.";
  }
  if (err instanceof Anthropic.PermissionDeniedError) return "Bu AI kalitiga ushbu modeldan foydalanishga ruxsat yo'q.";
  if (err instanceof Anthropic.NotFoundError) return `AI modeli topilmadi (${MODEL}). Render'dagi AI_MODEL qiymatini tekshiring.`;
  if (err instanceof Anthropic.RateLimitError) return "So'rovlar limiti oshdi, bir daqiqadan so'ng urinib ko'ring.";
  if (err instanceof Anthropic.InternalServerError || err?.status === 529) return "AI xizmati hozir band, birozdan so'ng urinib ko'ring.";
  if (err instanceof Anthropic.APIConnectionError) return "AI xizmatiga ulanib bo'lmadi, internet aloqasini tekshiring.";
  if (err instanceof Anthropic.APIError) return `AI xizmati xatosi (${err.status}): ${text.slice(0, 200)}`;
  return "Serverda kutilmagan xato.";
}

export default router;
