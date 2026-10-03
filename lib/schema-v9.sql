-- Schema v9 — results control, race badge, countdown, scheduled vote packages.
-- Run once in the Neon SQL editor (safe to re-run).

-- 1) Results mode: 'closed' (ranking only) | 'percent' (ranking + % share per
--    category) | 'full' (ranking + each nominee's votes). Existing databases
--    start as 'percent' if results were public, 'closed' if they were hidden.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'config' AND column_name = 'results_mode') THEN
    ALTER TABLE config ADD COLUMN results_mode text NOT NULL DEFAULT 'percent';
    UPDATE config SET results_mode = CASE WHEN results_public THEN 'percent' ELSE 'closed' END;
  END IF;
END $$;

-- 2) Public-facing motivators the admin can switch on/off.
ALTER TABLE config ADD COLUMN IF NOT EXISTS show_race_badge boolean NOT NULL DEFAULT true;
ALTER TABLE config ADD COLUMN IF NOT EXISTS show_countdown  boolean NOT NULL DEFAULT true;

-- 3) Limited-time vote packages ("last hours" deals). All optional: a package
--    with no window behaves exactly as before.
ALTER TABLE vote_packages ADD COLUMN IF NOT EXISTS promo_label     text;
ALTER TABLE vote_packages ADD COLUMN IF NOT EXISTS available_from  timestamptz;
ALTER TABLE vote_packages ADD COLUMN IF NOT EXISTS available_until timestamptz;
