import "dotenv/config";

const isProd = process.env.NODE_ENV === "production";

function required(name, fallbackForDev) {
  const v = process.env[name];
  if (v) return v;
  if (!isProd && fallbackForDev !== undefined) return fallbackForDev;
  throw new Error(`.env da ${name} o'rnatilmagan`);
}

export const config = {
  isProd,
  port: Number(process.env.PORT || 4000),
  databaseUrl: required("DATABASE_URL", "postgres://bahra:bahra@localhost:5432/bahra_crm"),
  databaseSsl: process.env.DATABASE_SSL === "true",
  jwtSecret: required("JWT_SECRET", "dev-only-secret-change-me"),
  sessionHours: Number(process.env.SESSION_HOURS || 12),
  adminLogin: process.env.ADMIN_LOGIN || "admin",
  adminPassword: process.env.ADMIN_PASSWORD,
  aiModel: process.env.AI_MODEL || "claude-opus-5-5",
};

if (isProd && config.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET kamida 32 belgidan iborat bo'lishi kerak");
}
