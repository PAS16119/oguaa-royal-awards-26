-- v10: exact voting close time + "shuffle" display switch.
-- Run once in the Neon SQL editor. Safe to re-run.

-- Time of day the vote closes, "HH:MM" in 24h Ghana time (GMT). Blank = end of the close date.
ALTER TABLE config ADD COLUMN IF NOT EXISTS voting_close_time text;

-- When true (and results mode is "Closed - ranking only"), the public sees each
-- category's nominees in random order with no rank numbers. Switch off for the real ranking.
ALTER TABLE config ADD COLUMN IF NOT EXISTS results_shuffle boolean NOT NULL DEFAULT false;
