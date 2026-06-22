-- =============================================================================
-- Diet Tracker — Research roles & consent (P0-3/P0-4)
-- =============================================================================
-- Run AFTER 006_tdee_estimates.sql
--
-- Adds three columns to profiles:
--   role          — 'participant' (default) | 'researcher'
--   consented_at  — timestamp of IRB consent; NULL means not yet consented
--   study_cohort  — optional cohort label (e.g. 'control', 'xai_treatment')
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role          TEXT         NOT NULL DEFAULT 'participant'
    CHECK (role IN ('participant', 'researcher')),
  ADD COLUMN IF NOT EXISTS consented_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS study_cohort  TEXT;

COMMENT ON COLUMN public.profiles.role IS
  'participant = normal user; researcher = access to /research dashboard and export API';

COMMENT ON COLUMN public.profiles.consented_at IS
  'Set by POST /api/consent when the user accepts the study terms. NULL = not yet consented.';
