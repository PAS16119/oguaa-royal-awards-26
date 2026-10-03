-- ============================================================================
-- Repair split categories (e.g. "Fine Boy" listed under BOTH Senior and Open)
-- ----------------------------------------------------------------------------
-- WHY it happened: each nominee/candidate stores its own COPY of the group and
-- award name from the day it was created. When an award was moved to another
-- group, the earlier copies stayed behind, so one award showed up as two slots.
--
-- What this script touches: ONLY the group / award-name labels (and, for entries
-- that never had one, the award link). It never touches `votes`, `vote_payments`,
-- money, ballot codes or any nominee details.
--
-- SAFETY: make a Neon branch/snapshot first (1 minute). Run STEP 1 and look at
-- the results. Then run STEP 2. Then run STEP 1 again — 1a and 1b should be empty.
-- ============================================================================


-- ================================ STEP 1: LOOK (read-only) ==================

-- 1a. Ballot entries whose stored group/name no longer matches the live award list
SELECT c.nominee_name, c.votes,
       c.section_label AS "on ballot under", s.label AS "should be under",
       c.award_name    AS "ballot award",    a.name  AS "correct award"
FROM candidates c
JOIN awards a ON a.id = c.award_id
JOIN award_sections s ON s.key = a.section_key
WHERE c.section_key IS DISTINCT FROM s.key
   OR c.section_label IS DISTINCT FROM s.label
   OR c.award_name IS DISTINCT FROM a.name
ORDER BY a.name, c.nominee_name;

-- 1b. Ballot entries with NO link to an award at all (can't be fixed automatically
--     unless the award name matches exactly one award — STEP 2b handles those)
SELECT id, nominee_name, section_label, award_name, votes
FROM candidates WHERE award_id IS NULL;

-- 1c. Award names that currently appear under more than one group on the ballot
SELECT award_name, COUNT(DISTINCT section_label) AS groups,
       string_agg(DISTINCT section_label, '  |  ') AS "listed under", COUNT(*) AS entries
FROM candidates WHERE active
GROUP BY award_name HAVING COUNT(DISTINCT section_label) > 1;

-- 1d. The same award name defined TWICE in the award list (two real awards, not a stale copy)
SELECT a.name, COUNT(*) AS copies, string_agg(s.label || ' [' || a.id || ']', '  |  ') AS "defined in"
FROM awards a JOIN award_sections s ON s.key = a.section_key
WHERE a.active GROUP BY a.name HAVING COUNT(*) > 1;

-- 1e. The SAME PERSON listed twice in one award — their votes are split between two entries.
--     Fixing the group (STEP 2) will put these side by side. Do NOT delete either row.
--     Send me this result and we'll merge them properly with an audit trail.
SELECT COALESCE(c.award_id, c.award_name) AS award_key,
       MIN(c.award_name) AS award, lower(trim(c.nominee_name)) AS nominee,
       COUNT(*) AS entries, SUM(c.votes) AS combined_votes,
       string_agg(c.nominee_name || ' (' || c.votes || ' votes, code ' || COALESCE(c.ballot_code,'-') || ')', '  ;  ') AS entries_detail
FROM candidates c
GROUP BY COALESCE(c.award_id, c.award_name), lower(trim(c.nominee_name))
HAVING COUNT(*) > 1
ORDER BY 2;


-- ================================ STEP 2: REPAIR ===========================

-- 2a. Entries that know their award: copy the current group + award name from the award list
UPDATE candidates c
SET section_key = s.key, section_label = s.label, award_name = a.name
FROM awards a JOIN award_sections s ON s.key = a.section_key
WHERE c.award_id = a.id
  AND (c.section_key IS DISTINCT FROM s.key
    OR c.section_label IS DISTINCT FROM s.label
    OR c.award_name IS DISTINCT FROM a.name);

-- 2b. Entries with no award link: attach ONLY when their award name matches exactly one active award
UPDATE candidates c
SET award_id = m.id, section_key = m.section_key, section_label = m.label, award_name = m.name
FROM (
  SELECT a.id, a.name, a.section_key, s.label,
         COUNT(*) OVER (PARTITION BY a.name) AS same_name
  FROM awards a JOIN award_sections s ON s.key = a.section_key
  WHERE a.active
) m
WHERE c.award_id IS NULL AND c.award_name = m.name AND m.same_name = 1;

-- 2c. Same for the nominations behind them (keeps lists, exports and posters consistent)
UPDATE nominations n
SET section_key = s.key, section_label = s.label, category = a.name
FROM awards a JOIN award_sections s ON s.key = a.section_key
WHERE n.award_id = a.id
  AND (n.section_key IS DISTINCT FROM s.key
    OR n.section_label IS DISTINCT FROM s.label
    OR n.category IS DISTINCT FROM a.name);
