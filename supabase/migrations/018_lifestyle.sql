-- 018: Manual step tracking + sleep bed/wake times (phase D).
--
-- steps_logs mirrors the water_logs pattern (001_initial_schema.sql): one
-- row per (user, day), UPSERT on conflict. `source` distinguishes manual
-- entry from a future device-sync path (2026-07-17 decision: manual input
-- + 10k-goal bar now, swappable to a device source later without a schema
-- change — lib/data/steps.ts is the single write entry point that would grow
-- the 'device' branch).

CREATE TABLE public.steps_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logged_date  DATE        NOT NULL,
  steps        INTEGER     NOT NULL DEFAULT 0 CHECK (steps BETWEEN 0 AND 200000),
  source       TEXT        NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'device')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, logged_date)
);

CREATE INDEX steps_logs_user_date ON public.steps_logs (user_id, logged_date DESC);

ALTER TABLE public.steps_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "steps_logs: user owns rows"
  ON public.steps_logs FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Sleep bed/wake times — optional, alongside the existing sleep_hours/
-- sleep_quality columns on checkins (013_vitals.sql).
ALTER TABLE public.checkins
  ADD COLUMN bed_time  TIME,
  ADD COLUMN wake_time TIME;
