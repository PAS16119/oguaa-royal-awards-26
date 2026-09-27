-- Oguaa Royal Awards — SCHEMA v8
-- Per-co-admin section permissions. NULL (the default for every existing
-- co-admin) means "full access, same as today" — nobody loses access when
-- this migration runs. The Main Admin can then narrow individual co-admins
-- to specific sections from Admin → Co-Admins → Edit access.
-- Run once, after schema-v7.sql.

ALTER TABLE coadmins ADD COLUMN IF NOT EXISTS permissions jsonb;
