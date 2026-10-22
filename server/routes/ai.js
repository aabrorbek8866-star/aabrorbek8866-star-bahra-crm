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

  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      // Xavfsizlik filtri rad etsa, server avtomatik ravishda mos zaxira modelga o'tadi
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        // Agent prompti o'zgarmas — keshlanadi
        { type: "text", text: config.system, cache_control: { type: "ephemeral" } },
        {
          type: "text",
          text: `<crm_data generated_at="${new Date().toISOString()}">\n${JSON.stringify(context ?? {}, null, 1)}\n</crm_data>`,
        },
      ],
      messages: history,
    });

    stream.on("text", (delta) => res.write(delta));
    req.on("close", () => stream.abort());

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      res.write("\n\n_So'rov xavfsizlik siyosati sababli bajarilmadi. Iltimos, savolni boshqacha ifodalang._");
    } else if (final.stop_reason === "max_tokens") {
      res.write("\n\n_(Javob uzunlik chegarasiga yetdi — davomini so'rang.)_");
    }
    res.end();
  } catch (err) {
    console.error("[AI]", err);
    const msg =
      err instanceof Anthropic.AuthenticationError || /authentication method/i.test(err?.message ?? "")
        ? "AI kaliti noto'g'ri yoki o'rnatilmagan (ANTHROPIC_API_KEY)."
        : err instanceof Anthropic.RateLimitError
          ? "So'rovlar limiti oshdi, birozdan so'ng urinib ko'ring."
          : err instanceof Anthropic.APIError
            ? `AI xizmati xatosi (${err.status}).`
            : "Serverda kutilmagan xato.";
    if (!res.headersSent) res.status(500);
    res.end(`\n\n⚠️ ${msg}`);
  }
});

export default router;
