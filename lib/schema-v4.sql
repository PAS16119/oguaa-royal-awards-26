-- Oguaa Royal Awards — SCHEMA v4
-- Adds paid-vote fundraising: candidates (promoted from paid-track nominations),
-- vote packages ("premium levels"), and vote payments.
-- Safe to run once, on top of schema.sql + schema-v2.sql + schema-v3.sql.
-- Run this once in the Neon SQL Editor.

-- ------------------------------------------------------------- VOTING SETTINGS
ALTER TABLE config ADD COLUMN IF NOT EXISTS voting_enabled         boolean DEFAULT false;
ALTER TABLE config ADD COLUMN IF NOT EXISTS vote_price_ghs         numeric DEFAULT 1;
ALTER TABLE config ADD COLUMN IF NOT EXISTS voting_open_date       date;
ALTER TABLE config ADD COLUMN IF NOT EXISTS voting_close_date      date;
ALTER TABLE config ADD COLUMN IF NOT EXISTS max_votes_per_purchase integer DEFAULT 500;

-- ------------------------------------------------------------------ CANDIDATES
-- The voting ballot. Deliberately NOT auto-generated from nominations — an
-- admin or co-admin explicitly promotes a paid-track nomination onto the
-- ballot, so a stray or duplicate nomination never becomes voteable by accident.
CREATE TABLE IF NOT EXISTS candidates (
  id            text PRIMARY KEY,
  nomination_id text REFERENCES nominations(id),
  award_id      text,
  section_key   text,
  section_label text,
  award_name    text,
  nominee_name  text NOT NULL,
  nominee_class text,
  nominee_house text,
  photo_url     text,
  votes         bigint NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  created_by    text
);
CREATE INDEX IF NOT EXISTS idx_candidates_award  ON candidates (award_id);
CREATE INDEX IF NOT EXISTS idx_candidates_active ON candidates (active);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_candidate_per_nomination ON candidates (nomination_id);

-- --------------------------------------------------------- VOTE PACKAGES ("premium levels")
CREATE TABLE IF NOT EXISTS vote_packages (
  id         text PRIMARY KEY,
  label      text NOT NULL,          -- e.g. "Bronze Supporter"
  votes      integer NOT NULL,
  price_ghs  numeric NOT NULL,
  sort_order integer DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------- VOTE PAYMENTS
-- Mirrors `payments` (the code-purchase table) but for votes. One row per
-- checkout attempt. Status moves pending -> paid exactly once per reference;
-- that single transition is what makes vote crediting idempotent.
CREATE TABLE IF NOT EXISTS vote_payments (
  reference      text PRIMARY KEY,
  candidate_id   text REFERENCES candidates(id),
  package_id     text,
  votes          integer NOT NULL,
  buyer_name     text,
  email          text,
  phone          text,
  amount_pesewas integer NOT NULL,
  currency       text DEFAULT 'GHS',
  status         text NOT NULL DEFAULT 'pending',  -- pending | paid | failed | voided
  channel        text,
  created_at     timestamptz DEFAULT now(),
  paid_at        timestamptz,
  voided_at      timestamptz,
  void_reason    text,
  raw            jsonb
);
CREATE INDEX IF NOT EXISTS idx_vote_payments_status    ON vote_payments (status);
CREATE INDEX IF NOT EXISTS idx_vote_payments_candidate ON vote_payments (candidate_id);
CREATE INDEX IF NOT EXISTS idx_vote_payments_created   ON vote_payments (created_at DESC);
