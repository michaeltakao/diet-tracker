-- =============================================================================
-- Diet Tracker — Vitals logging (BP / glucose) + check-in sleep quality/stress
-- =============================================================================
-- Run AFTER 012_engagement.sql
--
-- 1. badge_type enum top-up: vitals_week (5 vital-log days in a rolling 7).
--    NOTE: ALTER TYPE ... ADD VALUE cannot be USED in the same transaction
--    that adds it (PG rule), so it comes first, is idempotent, and nothing
--    below references the new value.
--
-- 2. vital_logs: per-measurement rows (no daily UNIQUE — multiple readings a
--    day are normal). One table for both kinds with per-kind nullable columns
--    and an XOR CHECK. Bounds are WIDE PLAUSIBILITY ONLY (data-entry guard):
--    the app records values and never interprets them — no thresholds, no
--    verdicts, no diagnosis.
--
-- 3. checkins: optional sleep_quality / stress_level 1–5 self-ratings
--    (sleep *hours* already exist on the table).
-- =============================================================================

ALTER TYPE public.badge_type ADD VALUE IF NOT EXISTS 'vitals_week';

CREATE TABLE public.vital_logs (
  id              UUID        PRIMARY KEY,             -- client-generated
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logged_date     DATE        NOT NULL,                -- JST day
  kind            TEXT        NOT NULL CHECK (kind IN ('blood_pressure', 'blood_glucose')),
  -- blood_pressure columns (wide plausibility bounds; record, never interpret)
  systolic        SMALLINT    CHECK (systolic  BETWEEN 50 AND 300),
  diastolic       SMALLINT    CHECK (diastolic BETWEEN 30 AND 200),
  -- blood_glucose columns
  glucose_mg_dl   SMALLINT    CHECK (glucose_mg_dl BETWEEN 20 AND 600),
  glucose_context TEXT        CHECK (glucose_context IN ('fasting', 'postprandial', 'random')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- XOR: exactly the columns of the declared kind, nothing of the other
  CONSTRAINT vital_logs_kind_shape CHECK (
    (kind = 'blood_pressure'
      AND systolic IS NOT NULL AND diastolic IS NOT NULL
      AND glucose_mg_dl IS NULL AND glucose_context IS NULL)
    OR
    (kind = 'blood_glucose'
      AND glucose_mg_dl IS NOT NULL AND glucose_context IS NOT NULL
      AND systolic IS NULL AND diastolic IS NULL)
  )
);

CREATE INDEX vital_logs_user_date ON public.vital_logs (user_id, logged_date DESC);

ALTER TABLE public.vital_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vital_logs: user owns rows"
  ON public.vital_logs FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.checkins
  ADD COLUMN sleep_quality SMALLINT CHECK (sleep_quality BETWEEN 1 AND 5),
  ADD COLUMN stress_level  SMALLINT CHECK (stress_level  BETWEEN 1 AND 5);
