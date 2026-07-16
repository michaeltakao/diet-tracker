-- =============================================================================
-- Diet Tracker — Symptom log (record + display only, never diagnostic)
-- =============================================================================
-- Run AFTER 013_vitals.sql
--
-- symptom_logs: per-event rows (no daily UNIQUE — multiple symptoms a day are
-- normal). trigger_tag (NOT "trigger" — PG keyword risk) holds a free chip
-- value (食事/運動/ストレス/天候/睡眠不足/不明), kept TEXT for flexibility.
--
-- related_meal_id / related_workout_id are PLAIN UUIDs with NO hard FKs:
-- food_logs/workout_logs ids are client-generated and guest-mode entries
-- never reach the server, so FK constraints would be unsatisfiable. Names are
-- denormalized alongside so reports survive log deletion.
-- =============================================================================

CREATE TABLE public.symptom_logs (
  id                   UUID        PRIMARY KEY,        -- client-generated
  user_id              UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logged_date          DATE        NOT NULL,           -- JST day of onset
  symptom_name         TEXT        NOT NULL,
  onset_at             TIMESTAMPTZ NOT NULL,
  duration_minutes     INT         CHECK (duration_minutes > 0 AND duration_minutes <= 10080),
  severity             SMALLINT    NOT NULL CHECK (severity BETWEEN 1 AND 10),
  trigger_tag          TEXT,
  action_taken         TEXT,
  note                 TEXT,
  related_meal_id      UUID,                           -- plain link, no FK (by design)
  related_meal_name    TEXT,                           -- denormalized at link time
  related_workout_id   UUID,                           -- plain link, no FK (by design)
  related_workout_name TEXT,                           -- denormalized at link time
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX symptom_logs_user_date ON public.symptom_logs (user_id, logged_date DESC);

ALTER TABLE public.symptom_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "symptom_logs: user owns rows"
  ON public.symptom_logs FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
