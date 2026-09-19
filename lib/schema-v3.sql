-- Oguaa Royal Awards — SCHEMA v3
-- Adds the Co-Admin (committee helper) role, on top of schema.sql and schema-v2.sql.
-- Safe to run once, and safe alongside the earlier files — nothing here touches
-- existing tables or data.
--
-- Run this once in the Neon SQL Editor after v2 is already in place.

CREATE TABLE IF NOT EXISTS coadmins (
  id text PRIMARY KEY,
  name text NOT NULL,
  pin_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by text,
  last_login_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_coadmins_active ON coadmins (active);
