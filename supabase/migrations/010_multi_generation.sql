-- =============================================================================
-- Diet Tracker — Multi-generation round (age-aware nutrition & consent gate)
-- =============================================================================
-- Run AFTER 009_food_logging_v2.sql
--
-- profiles gains three nullable columns:
--   sex                — optional; NULL means "unset" and the app uses
--                        sex-averaged 食事摂取基準 targets
--   height_cm          — optional; enables the Mifflin-St Jeor TDEE fallback
--   adult_confirmed_at — timestamp of the user's 18+ attestation on the
--                        research-consent form (APPI hygiene). Research
--                        participation is 18+; minors use the app guest-only.
--
-- Rerun-safe: ADD COLUMN IF NOT EXISTS throughout (pattern from 009).
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sex TEXT
    CHECK (sex IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS adult_confirmed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.sex IS
  'Optional. NULL = unset → sex-averaged 食事摂取基準 targets in the app.';
COMMENT ON COLUMN public.profiles.height_cm IS
  'Optional height in cm; enables the Mifflin-St Jeor TDEE fallback.';
COMMENT ON COLUMN public.profiles.adult_confirmed_at IS
  '18+ attestation recorded at research consent; research participation is adults-only.';
