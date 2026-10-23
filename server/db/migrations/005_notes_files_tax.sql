-- Mijoz kabineti: izohlar, pasport nusxalari, notarius summasi; kompaniya sozlamalari (soliq)

CREATE TABLE IF NOT EXISTS client_notes (
  id         SERIAL PRIMARY KEY,
  client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  text       TEXT NOT NULL CHECK (length(trim(text)) > 0),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_notes_client_idx ON client_notes (client_id, created_at DESC);

-- Fayllar bazada (BYTEA): server qayta o'rnatilsa ham yo'qolmaydi va kunlik zaxiraga kiradi
CREATE TABLE IF NOT EXISTS client_files (
  id         SERIAL PRIMARY KEY,
  client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'passport',
  name       TEXT NOT NULL,
  mime       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  data       BYTEA NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_files_client_idx ON client_files (client_id, kind);

-- Notarial shartnomada ko'rsatilgan summa
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notary_amount BIGINT;

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
