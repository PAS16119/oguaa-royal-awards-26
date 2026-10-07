-- Schema v11 — "reveal winners" switch + a fixed shuffle seed (for the Reshuffle button).
-- Run once in the Neon SQL editor (safe to re-run). It does not touch votes, payments or nominees.
--
-- Run this AFTER schema-v9.sql and schema-v10.sql (v10 adds the shuffle switch and the close time).

-- Winners (the Winners page and the trophy) stay hidden from the public until the admin reveals them.
ALTER TABLE config ADD COLUMN IF NOT EXISTS winners_public boolean NOT NULL DEFAULT false;

-- The shuffled order is derived from this number, so it stays EXACTLY the same for everyone
-- until the admin presses "Reshuffle", which just picks a new number.
ALTER TABLE config ADD COLUMN IF NOT EXISTS shuffle_seed integer NOT NULL DEFAULT 1;
