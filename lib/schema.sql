-- Oguaa Royal Awards — database schema
-- Run this once against your Neon Postgres database (Neon SQL Editor, or `psql "$DATABASE_URL" -f lib/schema.sql`)

CREATE TABLE IF NOT EXISTS admin_auth (
  id text PRIMARY KEY,
  pin_hash text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents (
  id text PRIMARY KEY,
  name text NOT NULL,
  pin_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by text,
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS codes (
  code text PRIMARY KEY,
  status text NOT NULL DEFAULT 'unused', -- 'unused' | 'used' | 'void'
  source text DEFAULT 'offline',
  issued_by_type text,   -- 'main-admin' | 'agent'
  issued_by_id text,     -- agent id, null for main-admin
  issued_by_name text,   -- 'Main Admin' or agent name (denormalized for fast display)
  created_at timestamptz DEFAULT now(),
  used_at timestamptz,
  nomination_id text
);
CREATE INDEX IF NOT EXISTS idx_codes_issued_by ON codes (issued_by_type, issued_by_id);
CREATE INDEX IF NOT EXISTS idx_codes_status ON codes (status);

CREATE TABLE IF NOT EXISTS nominations (
  id text PRIMARY KEY,
  code text REFERENCES codes(code),
  section_key text,
  section_label text,
  category text,
  nominee_name text,
  nominee_class text,
  nominee_house text,
  reason text,
  photo_url text,
  nominator_name text,
  nominator_phone text,
  relation text,
  submitted_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nominations_section ON nominations (section_key, category);

CREATE TABLE IF NOT EXISTS audit_log (
  id serial PRIMARY KEY,
  ts timestamptz DEFAULT now(),
  actor_type text,
  actor_id text,
  actor_name text,
  action text,
  details jsonb
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log (ts DESC);

CREATE TABLE IF NOT EXISTS config (
  id text PRIMARY KEY,
  event_name text,
  price_ghs numeric DEFAULT 10,
  open_date date,
  close_date date,
  momo_name text,
  momo_number text,
  momo_network text
);

INSERT INTO config (id, event_name, price_ghs, momo_name, momo_number, momo_network)
VALUES ('main', 'OSTECH 35th Anniversary — Oguaa Royal Awards Night', 10, '(set in Admin → Settings)', '0XX XXX XXXX', 'MTN MoMo')
ON CONFLICT (id) DO NOTHING;
