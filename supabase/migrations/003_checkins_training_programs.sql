-- =============================================================================
-- Diet Tracker — Check-ins & Training Programs
-- =============================================================================
-- Run AFTER 002_profile_enhancement.sql
--
-- Tables created:
--   checkins          — daily mood / energy / sleep / soreness check-ins
--   training_programs — user-defined workout programs stored as JSONB
-- =============================================================================


-- ── checkins ──────────────────────────────────────────────────────────────────
-- One row per user per day. UPSERT on (user_id, logged_date).

CREATE TABLE public.checkins (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logged_date     DATE         NOT NULL,
  mood            SMALLINT     NOT NULL CHECK (mood    BETWEEN 1 AND 5),
  energy          SMALLINT     NOT NULL CHECK (energy  BETWEEN 1 AND 5),
  sleep_hours     NUMERIC(3,1) NOT NULL CHECK (sleep_hours >= 0 AND sleep_hours <= 24),
  soreness_areas  TEXT[]       NOT NULL DEFAULT '{}',
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, logged_date)
);

CREATE INDEX checkins_user_date ON public.checkins (user_id, logged_date DESC);

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkins: user owns rows"
  ON public.checkins FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── training_programs ─────────────────────────────────────────────────────────
-- Stores full TrainingProgram JSON as JSONB.
-- client_id is the localStorage UUID so upserts can match records across devices.

CREATE TABLE public.training_programs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id   TEXT        NOT NULL,           -- localStorage uid() generated ID
  data        JSONB       NOT NULL,           -- full TrainingProgram object
  is_active   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, client_id)
);

CREATE TRIGGER training_programs_updated_at
  BEFORE UPDATE ON public.training_programs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX training_programs_user ON public.training_programs (user_id);
CREATE INDEX training_programs_active ON public.training_programs (user_id, is_active)
  WHERE is_active = true;

ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_programs: user owns rows"
  ON public.training_programs FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
