-- =============================================================================
-- DRAFT — NOT A MIGRATION YET. Do not apply. (vault ADR-011)
-- =============================================================================
-- Kept outside supabase/migrations/ on purpose so no tool applies it.
-- Production DDL needs separate approval from the user.
--
-- Drops the tables whose only writers/readers were deleted on branch
-- refactor/core-loop (ADR-011). Until this runs, the app simply stops
-- writing to them; nothing reads them (verified by grep of `.from('…')`
-- in app/ lib/ components/ on 2026-11-17, and of supabase/migrations/ and
-- docs/trial/*.sql for cross-references — only comments).
--
-- NOT dropped, on purpose:
--   training_programs — cohort-queries.sql S5 reads it (planned_per_week /
--                       adherence). Decide at the analysis-plan freeze.
--   personal_records  — historic rows; lib/migrate.ts still uploads local PRs.
--   water_logs        — water tracking is kept (one small dashboard row).
--
-- Self-delete (/api/participant/self-delete) relies on ON DELETE CASCADE
-- from profiles, so dropping these tables does not affect it.
--
-- Step 0 (run first, read-only): row counts. If any is > 0, export the rows
-- (Supabase dashboard → Table editor → Export CSV) and keep them with the
-- study records before dropping — family-trial rows may exist.
--
--   select 'badges' t, count(*) from public.badges
--   union all select 'weekly_reports',    count(*) from public.weekly_reports
--   union all select 'checkins',          count(*) from public.checkins
--   union all select 'tdee_estimates',    count(*) from public.tdee_estimates
--   union all select 'weekly_challenges', count(*) from public.weekly_challenges
--   union all select 'vital_logs',        count(*) from public.vital_logs
--   union all select 'symptom_logs',      count(*) from public.symptom_logs
--   union all select 'steps_logs',        count(*) from public.steps_logs
--   union all select 'user_ranks',        count(*) from public.user_ranks
--   union all select 'user_quests',       count(*) from public.user_quests
--   union all select 'user_titles',       count(*) from public.user_titles
--   union all select 'user_challenges',   count(*) from public.user_challenges
--   union all select 'exercise_ranks',    count(*) from public.exercise_ranks;
--
-- After applying: regenerate lib/database.types.ts (Supabase MCP
-- generate_typescript_types) and update docs/trial/data-dictionary.md.
-- =============================================================================

BEGIN;

-- Gamification (020–024, 012, 001)
DROP TABLE IF EXISTS public.exercise_ranks;
DROP TABLE IF EXISTS public.user_challenges;
DROP TABLE IF EXISTS public.user_titles;
DROP TABLE IF EXISTS public.user_quests;
DROP TABLE IF EXISTS public.user_ranks;
DROP TABLE IF EXISTS public.weekly_challenges;
DROP TABLE IF EXISTS public.badges;
DROP TYPE  IF EXISTS public.badge_type;

-- Health logs (013, 014, 017)
DROP TABLE IF EXISTS public.symptom_logs;
DROP TABLE IF EXISTS public.vital_logs;

-- Workout tooling / extra AI / low-value trackers (003, 006, 018, 001)
DROP TABLE IF EXISTS public.checkins;
DROP TABLE IF EXISTS public.tdee_estimates;
DROP TABLE IF EXISTS public.steps_logs;
DROP TABLE IF EXISTS public.weekly_reports;

COMMIT;
