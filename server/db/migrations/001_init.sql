-- Bahra Building CRM — boshlang'ich sxema

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  login         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'cashier')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Xonadon: 7 qavat × 2 podyezd × 4 = 56 ta
CREATE TABLE apartments (
  id       INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 56),
  entrance INTEGER NOT NULL CHECK (entrance IN (1, 2)),
  floor    INTEGER NOT NULL CHECK (floor BETWEEN 1 AND 7),
  area     NUMERIC(7, 2) NOT NULL DEFAULT 0,
  rooms    INTEGER NOT NULL DEFAULT 0,
  status   TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('sold', 'free'))
);

-- Mijoz: bitta xonadonga bitta shartnoma
CREATE TABLE clients (
  id                 SERIAL PRIMARY KEY,
  apartment_id       INTEGER NOT NULL UNIQUE REFERENCES apartments(id),
  full_name          TEXT NOT NULL,
  passport           TEXT NOT NULL DEFAULT '',
  phone              TEXT NOT NULL DEFAULT '',
  contract_number    TEXT NOT NULL UNIQUE,
  contract_date      DATE NOT NULL,
  last_payment_date  DATE,
  total_price        BIGINT NOT NULL DEFAULT 0,
  down_payment       BIGINT NOT NULL DEFAULT 0,
  monthly_payment    BIGINT NOT NULL DEFAULT 0,
  installment_months INTEGER NOT NULL DEFAULT 24,
  contract_pdf       BYTEA,
  contract_pdf_name  TEXT,
  contract_pdf_at    TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- To'lov tarixi. Izoh majburiy.
CREATE TABLE payments (
  id         SERIAL PRIMARY KEY,
  client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  date       DATE NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('humo', 'uzcard', 'bank', 'cash')),
  amount     BIGINT NOT NULL CHECK (amount > 0),
  comment    TEXT NOT NULL CHECK (length(trim(comment)) >= 3),
  import_key TEXT UNIQUE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMPTZ
);
CREATE INDEX payments_client_idx ON payments (client_id, date);
CREATE INDEX payments_date_idx ON payments (date);

CREATE TABLE sms_log (
  id        SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  phone     TEXT NOT NULL,
  message   TEXT NOT NULL,
  ok        BOOLEAN NOT NULL,
  dry_run   BOOLEAN NOT NULL DEFAULT FALSE,
  error     TEXT,
  sent_by   INTEGER REFERENCES users(id),
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Har bir muhim harakat (to'lov qo'shish/o'zgartirish/o'chirish, import, PDF, SMS, foydalanuvchilar)
CREATE TABLE audit_log (
  id        BIGSERIAL PRIMARY KEY,
  user_id   INTEGER REFERENCES users(id),
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id TEXT,
  details   JSONB,
  at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_at_idx ON audit_log (at DESC);
