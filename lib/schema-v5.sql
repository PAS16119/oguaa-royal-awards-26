-- Oguaa Royal Awards — SCHEMA v5
-- Adds what USSD voting needs on top of v4: a short numeric ballot code per
-- candidate (so a feature phone can dial it in), a public results-visibility
-- toggle (the "suspense switch"), and a session table for the USSD webhook.
-- Safe to run once, on top of schema.sql + schema-v2.sql + schema-v3.sql + schema-v4.sql.
-- Run this once in the Neon SQL Editor.

-- --------------------------------------------------------------- BALLOT CODES
-- Short, digits-only so a feature-phone keypad can type it without T9.
-- Nullable at first so the migration doesn't fail on existing candidates —
-- app/api/candidates/route.js backfills one immediately below.
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ballot_code text;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_candidate_ballot_code ON candidates (ballot_code) WHERE ballot_code IS NOT NULL;

-- Backfill any candidates added before this migration with a 3-digit code.
-- Loops in SQL because we need to check uniqueness against codes assigned
-- earlier in the same loop, not just what's already in the table.
DO $$
DECLARE
  r RECORD;
  new_code text;
BEGIN
  FOR r IN SELECT id FROM candidates WHERE ballot_code IS NULL LOOP
    LOOP
      new_code := lpad((100 + floor(random() * 900))::int::text, 3, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM candidates WHERE ballot_code = new_code);
    END LOOP;
    UPDATE candidates SET ballot_code = new_code WHERE id = r.id;
  END LOOP;
END $$;

-- ------------------------------------------------------------- RESULTS TOGGLE
-- The "suspense switch" — when off, /vote and /vote/results (and the USSD
-- "check votes" option) stop showing per-candidate tallies to the public.
-- Admin/Co-Admin views are never affected by this.
ALTER TABLE config ADD COLUMN IF NOT EXISTS results_public boolean NOT NULL DEFAULT true;

-- ------------------------------------------------------------------ USSD SESSIONS
-- Arkesel only ever sends the single most recent key the caller pressed, not
-- the full dialled path, so we track where each session is ourselves. A
-- session is short-lived (Arkesel times sessions out after ~2.5 minutes of
-- inactivity) so this table is small and self-cleaning — see the DELETE in
-- app/api/ussd/route.js on every END, plus the maintenance query in the
-- USSD guide for stragglers from abandoned sessions.
CREATE TABLE IF NOT EXISTS ussd_sessions (
  session_id text PRIMARY KEY,
  msisdn     text NOT NULL,
  network    text,
  state      text NOT NULL DEFAULT 'welcome',
  data       jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ussd_sessions_created ON ussd_sessions (created_at);
