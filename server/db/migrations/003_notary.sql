-- Notarius: oldi-sotdi hujjatlari uchun mijoz rekvizitlari va notarial tasdiqlangan shartnoma (PDF)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS full_name_cyr      TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address            TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS passport_issued_by TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS passport_issued_at DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notarized          BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notarized_at       DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notary_pdf         BYTEA;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notary_pdf_name    TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notary_pdf_at      TIMESTAMPTZ;
