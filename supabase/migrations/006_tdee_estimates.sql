-- =============================================================================
-- Diet Tracker — TDEE estimates (P0-2: Adaptive TDEE Engine)
-- =============================================================================
-- Run AFTER 005_recommendation_feedback.sql
--
-- Stores per-user rolling TDEE estimates computed by lib/tdee.ts via
-- POST /api/tdee/estimate. Each row is one estimate for one calendar date.
-- The UNIQUE constraint enforces one estimate per (user, date); re-estimating
-- the same day overwrites via INSERT … ON CONFLICT DO UPDATE.
--
-- tdee_kcal        — inferred total daily energy expenditure (kcal)
-- window_days      — rolling window used for the regression (default 14)
-- r_squared        — OLS R² of the weight-vs-date regression (0–1); used as
--                    a confidence proxy. NULL when regression is degenerate.
-- data_points      — number of days with both a weight log AND food log entry
--                    in the window; drives the "X days collected" UI label.
-- =============================================================================

CREATE TABLE public.tdee_estimates (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  estimated_at    DATE         NOT NULL,
  tdee_kcal       NUMERIC(7,1) NOT NULL,
  window_days     SMALLINT     NOT NULL DEFAULT 14,
  r_squared       NUMERIC(5,4),
  data_points     SMALLINT     NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, estimated_at)
);

CREATE INDEX tdee_estimates_user_date ON public.tdee_estimates (user_id, estimated_at DESC);

ALTER TABLE public.tdee_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tdee_estimates: user owns rows"
  ON public.tdee_estimates FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
