-- =============================================================================
-- Diet Tracker — per-exercise strength rank (Liftoff-inspired), Phase 1
-- =============================================================================
-- Run AFTER 023_user_challenges.sql
--
-- exercise_ranks: one row per (user, exercise) holding the highest tier ever
-- achieved for that specific lift, based on estimated-1RM / bodyweight ratio
-- (lib/exercise-rank.ts getExerciseRank). Deliberately separate from
-- user_ranks (020_user_ranks.sql) — that table is the account-wide XP ladder
-- (Iron/Bronze/Silver/Platinum/Diamond); this one is per-lift and uses a
-- distinct novice/intermediate/advanced/expert/elite naming scheme so the
-- two systems never collide in the UI (user-approved decision).
--
-- Grain: one row per (user_id, exercise_id) — UNIQUE constraint enforces
-- this, upserted via ON CONFLICT in lib/data/exercise-rank.ts. Only the 10
-- curated weight-based starter exercises (see EXERCISE_RANK_THRESHOLDS in
-- lib/exercise-rank.ts) ever get a row — exercise_id is free TEXT, not FK'd
-- to a table of exercises (there is no exercises table; EXERCISE_DB is
-- code-only), so this migration cannot itself enforce "only rankable
-- exercises" — that's an application-layer invariant.
--
-- Ratchet semantics: rank only ever moves up (never downgrades on a lower
-- session), same "no row = not yet achieved" convention as
-- personal_records — there is no 'unranked' CHECK value because unranked is
-- the absence of a row, not a stored state.
--
-- TEXT CHECK enum (not a Postgres ENUM type), matching the anti-proliferation
-- convention established in 019_sus_responses.sql / 020_user_ranks.sql.
-- =============================================================================

CREATE TABLE public.exercise_ranks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id  TEXT        NOT NULL CHECK (char_length(exercise_id) > 0),
  rank         TEXT        NOT NULL CHECK (rank IN ('novice','intermediate','advanced','expert','elite')),
  achieved_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, exercise_id)
);

CREATE INDEX exercise_ranks_user_id ON public.exercise_ranks (user_id);

ALTER TABLE public.exercise_ranks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercise_ranks: user owns rows"
  ON public.exercise_ranks FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
