import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { migrate } from "./db/migrate.js";
import { bootstrap } from "./db/bootstrap.js";
import { requireAuth } from "./auth/middleware.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import dataRouter from "./routes/data.js";
import paymentsRouter from "./routes/payments.js";
import clientsRouter from "./routes/clients.js";
import importRouter from "./routes/import.js";
import smsRouter from "./routes/sms.js";
import aiRouter from "./routes/ai.js";
import auditRouter from "./routes/audit.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set("trust proxy", 1); // Render/Nginx ortida — to'g'ri IP (login limiti uchun) va HTTPS cookie
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
      },
    },
  }),
);
app.use(express.json({ limit: "10mb" })); // Excel import 56 qator + to'lovlar
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);

// Quyidagi barcha API'lar faqat tizimga kirgan xodimlar uchun
app.use("/api", requireAuth);
app.use("/api/data", dataRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/import", importRouter);
app.use("/api/sms", smsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/users", usersRouter);
app.use("/api/audit", auditRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "Topilmadi" }));

// Ishlab chiqarishda tayyor frontend (vite build) ham shu serverdan beriladi
const dist = path.join(here, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.code === "23505") return res.status(409).json({ error: "Bunday yozuv allaqachon mavjud (takroriy qiymat)" });
  if (err.name === "MulterError" || err.message?.includes("PDF")) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Serverda xatolik" });
});

await migrate();
await bootstrap();
app.listen(config.port, () => console.log(`Bahra CRM: http://localhost:${config.port}`));
