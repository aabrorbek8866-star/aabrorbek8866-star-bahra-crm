import { Router } from "express";
import multer from "multer";
import { query } from "../db/pool.js";
import { requirePerm } from "../auth/middleware.js";
import { ah } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";
import { CLIENT_COLUMNS, toClient } from "../lib/mappers.js";

const router = Router();

// PDF to'g'ridan-to'g'ri bazada (BYTEA) saqlanadi: server qayta o'rnatilsa ham yo'qolmaydi va zaxira nusxaga kiradi
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // bepul Neon bazasi 0.5 GB — fayllarni ixcham saqlaymiz
  fileFilter: (_req, file, cb) =>
    file.mimetype === "application/pdf" ? cb(null, true) : cb(new Error("Faqat PDF fayl qabul qilinadi")),
});

router.post("/:id/contract", requirePerm("contracts:upload"), upload.single("file"), ah(async (req, res) => {
  const id = Number(req.params.id);
  if (!req.file) return res.status(400).json({ error: "Fayl yuborilmadi" });
  if (req.file.buffer.subarray(0, 5).toString() !== "%PDF-") return res.status(400).json({ error: "Fayl PDF formatida emas" });

  const { rows } = await query(
    `UPDATE clients SET contract_pdf = $1, contract_pdf_name = $2, contract_pdf_at = now(), updated_at = now()
     WHERE id = $3 RETURNING ${CLIENT_COLUMNS}`,
    [req.file.buffer, req.file.originalname, id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Mijoz topilmadi" });
  await audit(null, req.user.id, "upload_contract", "client", id, { name: req.file.originalname, size: req.file.size });
  res.json(toClient(rows[0]));
}));

router.get("/:id/contract", ah(async (req, res) => {
  const { rows } = await query("SELECT contract_pdf, contract_pdf_name, contract_number FROM clients WHERE id = $1", [Number(req.params.id)]);
  const row = rows[0];
  if (!row?.contract_pdf) return res.status(404).json({ error: "Shartnoma fayli yo'q" });
  const name = row.contract_pdf_name || `Shartnoma_${row.contract_number}.pdf`;
  res.removeHeader("Content-Security-Policy"); // brauzerning PDF ko'ruvchisi to'sib qo'yilmasin
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.send(row.contract_pdf);
}));

export default router;
