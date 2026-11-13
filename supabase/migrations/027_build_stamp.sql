-- =============================================================================
-- Diet Tracker — build stamp on analysed log rows (vault ADR-008 P0-11)
-- =============================================================================
-- Run AFTER 026_study_start.sql
--
-- The study's method section has to say "every participant used the same
-- build". Nothing in the data recorded which build wrote a row, so that claim
-- could not be checked. The client now stamps each food / weight / workout
-- write (lib/build-stamp.ts):
--
--   build_sha   — git commit the deployed bundle was built from
--                 (VERCEL_GIT_COMMIT_SHA at build time; 'local' off Vercel).
--   study_build — true when built with NEXT_PUBLIC_STUDY_BUILD=1.
--
-- NULL = unknown: rows written before this migration, and rows carried over
-- by the one-off localStorage → Supabase migration (lib/migrate.ts), which
-- re-uploads past data and must not claim the current build wrote it.
--
-- Client-supplied, like every other column on these tables (RLS lets users
-- write their own rows), so this is provenance, not tamper evidence. The
-- weekly freeze check (scripts/check-study-freeze.mjs) compares the deployed
-- SHA with the study tag independently of these columns.
--
-- An upsert overwrites the stamp, so an edited row carries the build that
-- last wrote it.
--
-- Only the three tables the cohort queries read (docs/trial/cohort-queries.sql).
-- Additive and nullable; no backfill.
-- =============================================================================

ALTER TABLE public.food_logs
  ADD COLUMN build_sha   TEXT    NULL,
  ADD COLUMN study_build BOOLEAN NULL;

ALTER TABLE public.weight_logs
  ADD COLUMN build_sha   TEXT    NULL,
  ADD COLUMN study_build BOOLEAN NULL;

ALTER TABLE public.workout_logs
  ADD COLUMN build_sha   TEXT    NULL,
  ADD COLUMN study_build BOOLEAN NULL;

COMMENT ON COLUMN public.food_logs.build_sha    IS 'Git SHA of the build that last wrote this row (lib/build-stamp.ts). NULL = unknown / pre-027 / bulk migration.';
COMMENT ON COLUMN public.food_logs.study_build  IS 'True when the writing build had NEXT_PUBLIC_STUDY_BUILD=1. NULL = unknown.';
COMMENT ON COLUMN public.weight_logs.build_sha  IS 'Git SHA of the build that last wrote this row (lib/build-stamp.ts). NULL = unknown / pre-027 / bulk migration.';
COMMENT ON COLUMN public.weight_logs.study_build IS 'True when the writing build had NEXT_PUBLIC_STUDY_BUILD=1. NULL = unknown.';
COMMENT ON COLUMN public.workout_logs.build_sha  IS 'Git SHA of the build that last wrote this row (lib/build-stamp.ts). NULL = unknown / pre-027 / bulk migration.';
COMMENT ON COLUMN public.workout_logs.study_build IS 'True when the writing build had NEXT_PUBLIC_STUDY_BUILD=1. NULL = unknown.';
