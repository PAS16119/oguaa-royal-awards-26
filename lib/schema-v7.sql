-- Oguaa Royal Awards — SCHEMA v7
-- Adds one configurable field: a custom background image for the printable
-- nominee poster (PosterCard), so the committee can use their own artwork
-- instead of the built-in royal-gradient design. Run once, after schema-v6.sql.

ALTER TABLE config ADD COLUMN IF NOT EXISTS poster_bg_url text;
