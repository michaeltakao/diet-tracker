-- =============================================================================
-- Diet Tracker — Engagement (FTUE roadmap 2026-07)
-- =============================================================================
-- Run AFTER 011_ai_usage.sql
--
-- 1. badge_type enum top-up: first_food / first_workout (first-log badges).
--    NOTE: ALTER TYPE ... ADD VALUE is non-transactional in the sense that a
--    new value cannot be USED in the same transaction that adds it (PG rule).
--    The ADD VALUE statements therefore come first, are idempotent
--    (IF NOT EXISTS), and nothing below references the new values.
--
-- 2. weekly_challenges: one row per (user, JST-Monday week) for the fixed
--    "log activity on N distinct days this week" challenge. Progress is
--    DERIVED client-side from the user's own logs and mirrored here
--    best-effort for research capture (dual-write pattern, like badges).
--    goal_days is fixed at 5 for now (no goal-selection UI).
-- =============================================================================

ALTER TYPE public.badge_type ADD VALUE IF NOT EXISTS 'first_food';
ALTER TYPE public.badge_type ADD VALUE IF NOT EXISTS 'first_workout';

CREATE TABLE public.weekly_challenges (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start    DATE        NOT NULL,              -- JST Monday of the challenge week
  goal_days     INT         NOT NULL DEFAULT 5 CHECK (goal_days BETWEEN 1 AND 7),
  progress_days INT         NOT NULL DEFAULT 0 CHECK (progress_days BETWEEN 0 AND 7),
  completed_at  TIMESTAMPTZ,                       -- first time progress reached goal
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX weekly_challenges_user_week ON public.weekly_challenges (user_id, week_start DESC);

ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_challenges: user owns rows"
  ON public.weekly_challenges FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
