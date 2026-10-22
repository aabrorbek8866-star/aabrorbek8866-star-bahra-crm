-- Haqiqiy C-blok ma'lumotlari uchun moslashtirish

-- Amaldagi shartnomalarda raqamlar takrorlanadi (masalan "2" ikki xonadonda) — noyoblik talabi olib tashlanadi
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_contract_number_key;
CREATE INDEX IF NOT EXISTS clients_contract_number_idx ON clients (contract_number);

-- Loyiha maydoni (area) bilan birga umumiy va yashash maydoni
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS total_area  NUMERIC(7, 2) NOT NULL DEFAULT 0;
ALTER TABLE apartments ADD COLUMN IF NOT EXISTS living_area NUMERIC(7, 2) NOT NULL DEFAULT 0;
