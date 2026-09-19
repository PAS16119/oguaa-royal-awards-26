-- ============================================================================
-- Oguaa Royal Awards — SCHEMA v2 (free nominations + online payment + editable
-- award list).
--
-- Safe to run on a database that already has schema.sql in it, and safe to run
-- more than once: every statement is IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- Run it once in the Neon SQL Editor, or:
--     psql "$DATABASE_URL" -f lib/schema-v2.sql
-- ============================================================================

-- ---------------------------------------------------------------- 1. CONFIG
ALTER TABLE config ADD COLUMN IF NOT EXISTS free_enabled        boolean DEFAULT true;
ALTER TABLE config ADD COLUMN IF NOT EXISTS free_open_date      date;
ALTER TABLE config ADD COLUMN IF NOT EXISTS free_close_date     date;
ALTER TABLE config ADD COLUMN IF NOT EXISTS free_max_per_phone  integer DEFAULT 6;
ALTER TABLE config ADD COLUMN IF NOT EXISTS free_photo_required boolean DEFAULT false;
ALTER TABLE config ADD COLUMN IF NOT EXISTS online_sales_enabled boolean DEFAULT false;
ALTER TABLE config ADD COLUMN IF NOT EXISTS max_codes_per_purchase integer DEFAULT 10;

-- ------------------------------------------------------- 2. AWARD CATALOGUE
-- The award list now lives in the database so the Main Admin can add, rename,
-- reorder, deactivate and delete categories without a code change.
CREATE TABLE IF NOT EXISTS award_sections (
  key        text PRIMARY KEY,
  track      text NOT NULL DEFAULT 'paid',   -- 'paid' | 'free'
  label      text NOT NULL,
  emoji      text,
  color      text,
  sort_order integer DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS awards (
  id          text PRIMARY KEY,
  section_key text NOT NULL REFERENCES award_sections(key) ON DELETE CASCADE,
  name        text NOT NULL,
  notes       text,                            -- criteria shown under the award
  nominable   boolean NOT NULL DEFAULT true,   -- false = decided from records only
  sort_order  integer DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_awards_section ON awards (section_key);

-- ------------------------------------------------------------ 3. NOMINATIONS
ALTER TABLE nominations ADD COLUMN IF NOT EXISTS track          text NOT NULL DEFAULT 'paid';
ALTER TABLE nominations ADD COLUMN IF NOT EXISTS award_id       text;
ALTER TABLE nominations ADD COLUMN IF NOT EXISTS nominator_role text;
ALTER TABLE nominations ADD COLUMN IF NOT EXISTS nominator_ip   text;
ALTER TABLE nominations ALTER COLUMN photo_url DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nominations_track ON nominations (track);

-- One person may not nominate twice for the same free award.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_free_phone_award
  ON nominations (nominator_phone, award_id) WHERE track = 'free';

-- --------------------------------------------------------------- 4. PAYMENTS
-- Paystack transactions. One row per checkout attempt; fulfilment is idempotent.
CREATE TABLE IF NOT EXISTS payments (
  reference      text PRIMARY KEY,
  buyer_name     text,
  email          text,
  phone          text,
  quantity       integer NOT NULL DEFAULT 1,
  amount_pesewas integer NOT NULL,
  currency       text DEFAULT 'GHS',
  status         text NOT NULL DEFAULT 'pending',  -- pending | paid | failed
  channel        text,
  codes          text[],
  created_at     timestamptz DEFAULT now(),
  paid_at        timestamptz,
  raw            jsonb
);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments (created_at DESC);

-- ------------------------------------------------------------------ 5. SEED
-- Runs only if the tables are empty (ON CONFLICT DO NOTHING). After this,
-- edit everything from Admin -> Awards; re-running this file will not undo
-- your edits, and will not resurrect awards you deleted unless the id is gone.
-- ---- PAID TRACK (Oguaa Royal Awards, existing popular categories) ----
INSERT INTO award_sections (key, track, label, emoji, color, sort_order, active) VALUES ('junior', 'paid', 'Junior Student', '🧒', '#1F4E78', 0, true) ON CONFLICT (key) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('junior__junior-class-prefect-of-the-year', 'junior', 'Junior Class Prefect of the Year', true, NULL, 0, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('junior__most-talented-junior-student-female', 'junior', 'Most Talented Junior Student (Female)', true, NULL, 1, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('junior__most-talented-junior-student-male', 'junior', 'Most Talented Junior Student (Male)', true, NULL, 2, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('junior__most-popular-junior-student-female', 'junior', 'Most Popular Junior Student (Female)', true, NULL, 3, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('junior__most-popular-junior-student-male', 'junior', 'Most Popular Junior Student (Male)', true, NULL, 4, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('junior__most-influential-junior-student-of-the-year', 'junior', 'Most Influential Junior Student of the Year', true, NULL, 5, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('junior__junior-peer-mentor-of-the-year', 'junior', 'Junior Peer Mentor of the Year', true, NULL, 6, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('junior__most-punctual-student-of-the-year-junior', 'junior', 'Most Punctual Student of the Year (Junior)', true, NULL, 7, true) ON CONFLICT (id) DO NOTHING;

INSERT INTO award_sections (key, track, label, emoji, color, sort_order, active) VALUES ('senior', 'paid', 'Senior Student', '🎓', '#5B2E91', 1, true) ON CONFLICT (key) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__media-personality-of-the-year', 'senior', 'Media Personality of the Year', true, NULL, 0, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__fattest-wallet-d-bee-of-the-year', 'senior', 'Fattest Wallet (D-Bee) of the Year', true, NULL, 1, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__most-hardworking-class-prefect-of-the-year', 'senior', 'Most Hardworking Class Prefect of the Year', true, NULL, 2, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__most-hardworking-prefect-of-the-year', 'senior', 'Most Hardworking Prefect of the Year', true, NULL, 3, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__most-influential-student-of-the-year', 'senior', 'Most Influential Student of the Year', true, NULL, 4, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__most-talented-student-of-the-year', 'senior', 'Most Talented Student of the Year', true, NULL, 5, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__most-fashionable-student-female', 'senior', 'Most Fashionable Student (Female)', true, NULL, 6, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__most-fashionable-student-male', 'senior', 'Most Fashionable Student (Male)', true, NULL, 7, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__most-photogenic-student-female', 'senior', 'Most Photogenic Student (Female)', true, NULL, 8, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__most-photogenic-student-male', 'senior', 'Most Photogenic Student (Male)', true, NULL, 9, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__fine-girl-of-the-year', 'senior', 'Fine Girl of the Year', true, NULL, 10, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__fine-boy-of-the-year', 'senior', 'Fine Boy of the Year', true, NULL, 11, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__most-popular-student-female', 'senior', 'Most Popular Student (Female)', true, NULL, 12, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__most-popular-student-male', 'senior', 'Most Popular Student (Male)', true, NULL, 13, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__senior-peer-mentor-of-the-year', 'senior', 'Senior Peer Mentor of the Year', true, NULL, 14, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__most-punctual-student-of-the-year-senior', 'senior', 'Most Punctual Student of the Year (Senior)', true, NULL, 15, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__lady-of-the-year', 'senior', 'Lady of the Year', true, NULL, 16, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__gentleman-of-the-year', 'senior', 'Gentleman of the Year', true, NULL, 17, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('senior__best-student-personality-of-the-year', 'senior', 'Best Student Personality of the Year', true, NULL, 18, true) ON CONFLICT (id) DO NOTHING;

INSERT INTO award_sections (key, track, label, emoji, color, sort_order, active) VALUES ('open', 'paid', 'Open Category (Junior & Senior)', '🤝', '#B3891F', 2, true) ON CONFLICT (key) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('open__best-debater-of-the-year', 'open', 'Best Debater of the Year', true, NULL, 0, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('open__most-hilarious-student-of-the-year', 'open', 'Most Hilarious Student of the Year', true, NULL, 1, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('open__future-icon-most-likely-to-blow-of-the-year', 'open', 'Future Icon (Most Likely to Blow) of the Year', true, NULL, 2, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('open__heart-of-gold-kindest-student-of-the-year', 'open', 'Heart of Gold (Kindest Student) of the Year', true, NULL, 3, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('open__most-eloquent-student-of-the-year', 'open', 'Most Eloquent Student of the Year', true, NULL, 4, true) ON CONFLICT (id) DO NOTHING;

INSERT INTO award_sections (key, track, label, emoji, color, sort_order, active) VALUES ('staff', 'paid', 'Teaching Staff', '🏅', '#7A1F3D', 3, true) ON CONFLICT (key) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('staff__most-punctual-teacher-of-the-year', 'staff', 'Most Punctual Teacher of the Year', true, NULL, 0, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('staff__form-master-mistress-of-the-year', 'staff', 'Form Master/Mistress of the Year', true, NULL, 1, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('staff__no-nonsense-teacher-disciplinarian-of-the-year', 'staff', 'No-Nonsense Teacher (Disciplinarian) of the Year', true, NULL, 2, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('staff__most-feeling-teacher-of-the-year', 'staff', 'Most Feeling Teacher of the Year', true, NULL, 3, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('staff__most-popular-teacher-of-the-year', 'staff', 'Most Popular Teacher of the Year', true, NULL, 4, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('staff__house-master-mistress-of-the-year', 'staff', 'House Master/Mistress of the Year', true, NULL, 5, true) ON CONFLICT (id) DO NOTHING;

INSERT INTO award_sections (key, track, label, emoji, color, sort_order, active) VALUES ('others', 'paid', 'Others', '🏫', '#0F5132', 4, true) ON CONFLICT (key) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('others__campus-club-of-the-year', 'others', 'Campus Club of the Year', true, NULL, 0, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('others__department-of-the-year', 'others', 'Department of the Year', true, NULL, 1, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('others__best-pals-of-the-year', 'others', 'Best Pals of the Year', true, NULL, 2, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('others__best-house-of-the-year', 'others', 'Best House of the Year', true, NULL, 3, true) ON CONFLICT (id) DO NOTHING;

-- ---- FREE TRACK (35th Anniversary merit awards) ----
INSERT INTO award_sections (key, track, label, emoji, color, sort_order, active) VALUES ('merit-academic', 'free', 'Academic Awards (from records)', '📕', '#1F4E78', 0, true) ON CONFLICT (key) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-academic__best-student-in-each-department-all-subjects-combined', 'merit-academic', 'Best Student in Each Department (All Subjects Combined)', false, 'One per department, 9 departments. Highest aggregate across all departmental subjects.', 0, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-academic__best-student-in-each-subject-1st-place', 'merit-academic', 'Best Student in Each Subject — 1st Place', false, 'One per subject, 34 subjects. Highest subject score for the year.', 1, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-academic__best-student-in-each-subject-2nd-place-core-subjects', 'merit-academic', 'Best Student in Each Subject — 2nd Place (Core Subjects)', false, 'Second-highest subject score, core subjects only.', 2, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-academic__overall-best-student-form-2', 'merit-academic', 'Overall Best Student — Form 2', false, 'Highest overall aggregate in the form for the year.', 3, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-academic__overall-best-student-form-3', 'merit-academic', 'Overall Best Student — Form 3', false, 'Highest overall aggregate in the form for the year.', 4, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-academic__best-graduating-student-2026', 'merit-academic', 'Best Graduating Student (2026)', false, 'Best cumulative academic performance across the full duration of study.', 5, true) ON CONFLICT (id) DO NOTHING;

INSERT INTO award_sections (key, track, label, emoji, color, sort_order, active) VALUES ('merit-student', 'free', 'Student Merit & Character', '🌱', '#0F5132', 1, true) ON CONFLICT (key) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-student__most-improved-student-form-2', 'merit-student', 'Most Improved Student — Form 2', true, 'Largest positive change in aggregate/class position against the reference term.', 0, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-student__most-improved-student-form-3', 'merit-student', 'Most Improved Student — Form 3', true, 'Largest positive change in aggregate/class position against the reference term.', 1, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-student__sports-personality-male-form-2', 'merit-student', 'Sports Personality — Male (Form 2)', true, 'Performance, sportsmanship and consistency in inter-house, inter-school or regional competition.', 2, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-student__sports-personality-female-form-2', 'merit-student', 'Sports Personality — Female (Form 2)', true, 'Performance, sportsmanship and consistency in inter-house, inter-school or regional competition.', 3, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-student__sports-personality-male-form-3', 'merit-student', 'Sports Personality — Male (Form 3)', true, 'Performance, sportsmanship and consistency in inter-house, inter-school or regional competition.', 4, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-student__sports-personality-female-form-3', 'merit-student', 'Sports Personality — Female (Form 3)', true, 'Performance, sportsmanship and consistency in inter-house, inter-school or regional competition.', 5, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-student__most-disciplined-best-behaved-form-2', 'merit-student', 'Most Disciplined (Best Behaved) — Form 2', true, 'No recorded sanction; consistent conduct reports from teachers, prefects and house heads.', 6, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-student__most-disciplined-best-behaved-form-3', 'merit-student', 'Most Disciplined (Best Behaved) — Form 3', true, 'No recorded sanction; consistent conduct reports from teachers, prefects and house heads.', 7, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-student__most-hardworking-form-2', 'merit-student', 'Most Hardworking — Form 2', true, 'Diligence in class work, assignments and independent study across multiple subjects.', 8, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-student__most-hardworking-form-3', 'merit-student', 'Most Hardworking — Form 3', true, 'Diligence in class work, assignments and independent study across multiple subjects.', 9, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-student__most-outstanding-student-2026', 'merit-student', 'Most Outstanding Student (2026)', true, 'Exceptional achievement beyond academics: leadership, sports, arts, community service, competitions.', 10, true) ON CONFLICT (id) DO NOTHING;

INSERT INTO award_sections (key, track, label, emoji, color, sort_order, active) VALUES ('merit-staff', 'free', 'Staff Awards & Recognition', '🎖️', '#7A1F3D', 2, true) ON CONFLICT (key) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-staff__best-teaching-staff', 'merit-staff', 'Best Teaching Staff', true, 'Teaching effectiveness, professionalism, punctuality and contribution to school life. Top 3 become the shortlist; 2 runners-up.', 0, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-staff__best-non-teaching-staff', 'merit-staff', 'Best Non-Teaching Staff', true, 'Diligence, reliability, professionalism and contribution to smooth school operations. Top 3 become the shortlist; 2 runners-up.', 1, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-staff__long-service-award-teaching-staff', 'merit-staff', 'Long Service Award — Teaching Staff', true, '20+ years continuous service, good standing, not previously awarded.', 2, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-staff__long-service-award-non-teaching-staff', 'merit-staff', 'Long Service Award — Non-Teaching Staff', true, '20+ years continuous service, good standing, not previously awarded.', 3, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-staff__recognition-of-retired-past-staff', 'merit-staff', 'Recognition of Retired Past Staff', false, 'List finalised by the Awards Committee from service records.', 4, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO awards (id, section_key, name, nominable, notes, sort_order, active) VALUES ('merit-staff__special-honours', 'merit-staff', 'Special Honours', false, 'Dignitaries, PTA, traditional authority, benefactors and partners — list finalised by the Committee.', 5, true) ON CONFLICT (id) DO NOTHING;


-- Done. Check: SELECT track, count(*) FROM awards a JOIN award_sections s ON s.key=a.section_key GROUP BY 1;
