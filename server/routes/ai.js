import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { AGENTS } from "../agents/prompts.js";
import { config } from "../config.js";
import { requirePerm } from "../auth/middleware.js";

const router = Router();
const client = new Anthropic(); // ANTHROPIC_API_KEY ni muhitdan oladi
const MODEL = config.aiModel;

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
      final = await run(true);
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
