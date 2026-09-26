-- Oguaa Royal Awards — SCHEMA v6
-- Adds a single configurable field: the actual USSD shortcode voters dial
-- (e.g. "*928*135#"), so it can be shown on posters without hardcoding it
-- anywhere in the code. Run once, after schema-v5.sql.

ALTER TABLE config ADD COLUMN IF NOT EXISTS ussd_shortcode text;
