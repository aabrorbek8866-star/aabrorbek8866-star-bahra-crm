-- JSHSHIR (ЖШШИР / PINFL) — jismoniy shaxsning 14 xonali shaxsiy identifikatsiya raqami
ALTER TABLE clients ADD COLUMN IF NOT EXISTS jshshir TEXT NOT NULL DEFAULT '';
