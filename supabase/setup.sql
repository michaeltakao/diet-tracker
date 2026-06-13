-- ============================================================================
-- diet-tracker — combined database setup (GENERATED)
--
-- One-paste setup for a fresh Supabase project (SQL Editor → New query → paste
-- → Run). This is the in-order concatenation of supabase/migrations/001..005.
-- Requires a Supabase project (uses auth.* and storage.* schemas).
--
-- Regenerate after changing any migration:
--   cat supabase/migrations/0*.sql > supabase/setup.sql   (then re-add this header)
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- supabase/migrations/001_initial_schema.sql
-- ─────────────────────────────────────────────────────────────────────────
-- =============================================================================
-- Diet Tracker — Initial Schema Migration
-- =============================================================================
-- Run this in Supabase: Dashboard → SQL Editor → New query → Paste → Run
--
-- Tables created:
--   profiles, food_logs, workout_logs, weight_logs, water_logs,
--   badges, personal_records, weekly_reports
--
-- Includes:
--   - UUID primary keys (gen_random_uuid())
--   - Row Level Security on all tables
--   - Indexes for common query patterns
--   - Triggers: auto-create profile on signup, auto-update updated_at
-- =============================================================================


-- ── Extensions ────────────────────────────────────────────────────────────────
-- pgcrypto is pre-enabled in Supabase; gen_random_uuid() is available by default.


-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE public.meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
CREATE TYPE public.workout_category AS ENUM ('strength', 'cardio', 'flexibility', 'other');
CREATE TYPE public.muscle_part AS ENUM ('chest', 'back', 'legs', 'shoulders', 'arms', 'abs');
CREATE TYPE public.badge_type AS ENUM (
  'streak3', 'streak7', 'streak30',
  'water_goal', 'calorie_goal',
  'workout_master', 'pr_achieved'
);


-- ── Helper Functions ──────────────────────────────────────────────────────────

-- Automatically update updated_at on any table that uses it
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Auto-create a profile row when a new auth.users row is inserted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER   -- runs as the function owner (postgres), not the calling user
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;   -- idempotent: safe to re-run
  RETURN NEW;
END;
$$;


-- ── profiles ──────────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT,
  avatar_url      TEXT,
  lang            TEXT NOT NULL DEFAULT 'ja' CHECK (lang IN ('ja', 'en')),

  -- Daily goals (denormalised: avoids a JOIN on every API call)
  goal_calories   INTEGER     NOT NULL DEFAULT 2000  CHECK (goal_calories  > 0),
  goal_protein_g  NUMERIC(6,1) NOT NULL DEFAULT 150  CHECK (goal_protein_g >= 0),
  goal_fat_g      NUMERIC(6,1) NOT NULL DEFAULT 60   CHECK (goal_fat_g     >= 0),
  goal_carbs_g    NUMERIC(6,1) NOT NULL DEFAULT 200  CHECK (goal_carbs_g   >= 0),
  goal_water_ml   INTEGER     NOT NULL DEFAULT 2000  CHECK (goal_water_ml  > 0),
  goal_weight_kg  NUMERIC(5,1)         CHECK (goal_weight_kg > 0),

  -- Migration flag: set to NOW() after localStorage→Supabase migration completes
  migrated_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Fire on every new auth.users row (Google OAuth, email signup, etc.)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── food_logs ─────────────────────────────────────────────────────────────────

CREATE TABLE public.food_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logged_date  DATE        NOT NULL,
  meal_type    meal_type   NOT NULL,
  name         TEXT        NOT NULL CHECK (char_length(name) > 0),
  calories     INTEGER     NOT NULL CHECK (calories >= 0),
  protein_g    NUMERIC(6,1) NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  fat_g        NUMERIC(6,1) NOT NULL DEFAULT 0 CHECK (fat_g     >= 0),
  carbs_g      NUMERIC(6,1) NOT NULL DEFAULT 0 CHECK (carbs_g   >= 0),
  photo_url    TEXT,                      -- Supabase Storage URL (nullable)
  logged_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- when the meal was eaten
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary access pattern: get all food for a user on a specific date
CREATE INDEX food_logs_user_date   ON public.food_logs (user_id, logged_date DESC);
-- Secondary: recent foods quick-add (latest N unique names)
CREATE INDEX food_logs_user_logged ON public.food_logs (user_id, logged_at DESC);
-- Analytics: range queries (last 7 days, last 30 days)
-- food_logs_user_date covers this with logged_date DESC


-- ── workout_logs ──────────────────────────────────────────────────────────────

CREATE TABLE public.workout_logs (
  id            UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID             NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logged_date   DATE             NOT NULL,
  name          TEXT             NOT NULL CHECK (char_length(name) > 0),
  category      workout_category NOT NULL DEFAULT 'strength',
  muscle_part   muscle_part,               -- NULL for cardio/flexibility
  sets          SMALLINT         CHECK (sets          > 0),
  reps          SMALLINT         CHECK (reps          > 0),
  weight_kg     NUMERIC(6,2)     CHECK (weight_kg     >= 0),
  duration_min  SMALLINT         CHECK (duration_min  > 0),
  notes         TEXT,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary access pattern
CREATE INDEX workout_logs_user_date ON public.workout_logs (user_id, logged_date DESC);
-- PR check: "max weight for this exercise name"
CREATE INDEX workout_logs_name_weight ON public.workout_logs (user_id, name, weight_kg DESC NULLS LAST);


-- ── weight_logs ───────────────────────────────────────────────────────────────

CREATE TABLE public.weight_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logged_date  DATE        NOT NULL,
  weight_kg    NUMERIC(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 700),
  logged_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One entry per user per day (mirrors current storage.ts behaviour)
  UNIQUE (user_id, logged_date)
);

CREATE INDEX weight_logs_user_date ON public.weight_logs (user_id, logged_date DESC);


-- ── water_logs ────────────────────────────────────────────────────────────────
-- Stores daily total. Uses UPSERT (INSERT ... ON CONFLICT DO UPDATE).

CREATE TABLE public.water_logs (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logged_date  DATE    NOT NULL,
  total_ml     INTEGER NOT NULL DEFAULT 0 CHECK (total_ml >= 0),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, logged_date)
);

CREATE INDEX water_logs_user_date ON public.water_logs (user_id, logged_date DESC);


-- ── badges ────────────────────────────────────────────────────────────────────

CREATE TABLE public.badges (
  id          UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID       NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        badge_type NOT NULL,
  name        TEXT       NOT NULL,
  description TEXT       NOT NULL,
  icon        TEXT       NOT NULL,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Note: no UNIQUE on (user_id, type) — per-day badges (water_goal, calorie_goal)
  -- can be earned multiple times. Deduplication is handled at the application layer.
);

CREATE INDEX badges_user_type   ON public.badges (user_id, type);
CREATE INDEX badges_user_earned ON public.badges (user_id, earned_at DESC);


-- ── personal_records ──────────────────────────────────────────────────────────
-- One row per user per exercise. UPSERTed when a new PR is set.

CREATE TABLE public.personal_records (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_name   TEXT        NOT NULL CHECK (char_length(exercise_name) > 0),
  max_weight_kg   NUMERIC(6,2) NOT NULL CHECK (max_weight_kg > 0),
  achieved_date   DATE        NOT NULL,
  achieved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, exercise_name)
);

CREATE INDEX personal_records_user ON public.personal_records (user_id);


-- ── weekly_reports ────────────────────────────────────────────────────────────
-- Cache for AI-generated weekly coaching reports (one per user per week).
-- generated_at used to determine staleness (24h TTL in application layer).

CREATE TABLE public.weekly_reports (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start       DATE    NOT NULL,        -- Monday of the reported week
  strengths        TEXT[]  NOT NULL DEFAULT '{}',
  frictions        TEXT[]  NOT NULL DEFAULT '{}',
  next_week_target TEXT    NOT NULL DEFAULT '',
  weight_delta     NUMERIC(4,2),            -- kg change (negative = loss)
  avg_calories     INTEGER,
  protein_pct      NUMERIC(4,1),            -- % days hitting protein goal
  workout_days     SMALLINT,
  hydration_score  NUMERIC(4,1),            -- % days hitting water goal
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX weekly_reports_user_week ON public.weekly_reports (user_id, week_start DESC);


-- =============================================================================
-- Row Level Security
-- =============================================================================
-- Rule: users can only read/write their own data.
-- auth.uid() returns the UUID of the currently authenticated user.
-- =============================================================================

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports   ENABLE ROW LEVEL SECURITY;


-- ── profiles RLS ──────────────────────────────────────────────

CREATE POLICY "profiles: users read own row"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: users update own row"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT is handled by the trigger (SECURITY DEFINER), not by users directly.


-- ── Generic all-access policy for user-owned tables ───────────
-- Pattern: user_id column must equal auth.uid()

CREATE POLICY "food_logs: user owns rows"
  ON public.food_logs FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workout_logs: user owns rows"
  ON public.workout_logs FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "weight_logs: user owns rows"
  ON public.weight_logs FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "water_logs: user owns rows"
  ON public.water_logs FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "badges: user owns rows"
  ON public.badges FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "personal_records: user owns rows"
  ON public.personal_records FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "weekly_reports: user owns rows"
  ON public.weekly_reports FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- =============================================================================
-- Supabase Storage Bucket
-- =============================================================================
-- Run this AFTER the above schema, or in a separate query.
-- Creates the 'meal-photos' bucket for food photo uploads.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meal-photos',
  'meal-photos',
  false,                             -- private: URLs require authentication
  5242880,                           -- 5 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can only access their own folder ({user_id}/*)
CREATE POLICY "meal-photos: users manage own folder"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'meal-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'meal-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ─────────────────────────────────────────────────────────────────────────
-- supabase/migrations/002_profile_enhancement.sql
-- ─────────────────────────────────────────────────────────────────────────
-- =============================================================================
-- Diet Tracker — Profile Enhancement: Personalized Health Fields
-- =============================================================================
-- Run AFTER 001_initial_schema.sql
-- Adds age, health_conditions, dietary_restrictions, fitness_goal, activity_level
-- to the profiles table for personalized LLM-based recommendations.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age                  SMALLINT
    CHECK (age > 0 AND age < 150),

  ADD COLUMN IF NOT EXISTS health_conditions    TEXT[]
    NOT NULL DEFAULT '{}',

  ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT[]
    NOT NULL DEFAULT '{}',

  ADD COLUMN IF NOT EXISTS fitness_goal         TEXT
    NOT NULL DEFAULT 'maintenance'
    CHECK (fitness_goal IN (
      'weight_loss', 'muscle_gain', 'maintenance', 'endurance', 'flexibility'
    )),

  ADD COLUMN IF NOT EXISTS activity_level       TEXT
    NOT NULL DEFAULT 'moderately_active'
    CHECK (activity_level IN (
      'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'
    ));

-- ProfileUpdate already covers these via the trigger; no new RLS policies needed.
-- The existing "profiles: users update own row" policy covers all column updates.


-- ─────────────────────────────────────────────────────────────────────────
-- supabase/migrations/003_checkins_training_programs.sql
-- ─────────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────
-- supabase/migrations/004_profile_medications.sql
-- ─────────────────────────────────────────────────────────────────────────
-- =============================================================================
-- Diet Tracker — Profile: medications field
-- =============================================================================
-- Run AFTER 003_checkins_training_programs.sql
--
-- Adds medications[] column to profiles for personalized LLM safety checks.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS medications TEXT[] NOT NULL DEFAULT '{}';


-- ─────────────────────────────────────────────────────────────────────────
-- supabase/migrations/005_recommendation_feedback.sql
-- ─────────────────────────────────────────────────────────────────────────
-- =============================================================================
-- Diet Tracker — Recommendation feedback (Phase B: preference model)
-- =============================================================================
-- Run AFTER 004_profile_medications.sql
--
-- Stores explicit accept / reject / favorite reactions to recommended foods and
-- exercises. Feeds the content-based affinity model in lib/recommend-preference.ts.
--
-- At most one reaction per (user, item_type, item_name) — UPSERT on that key so a
-- later reaction overwrites an earlier one (latest wins), matching the localStorage
-- de-dup in lib/storage.ts:addRecommendationFeedback.
--
-- NOTE: until lib/database.types.ts is regenerated against this table
-- (`supabase gen types typescript`), the data layer persists feedback to
-- localStorage only; the Supabase dual-write in lib/data/recommendation-feedback.ts
-- is intentionally deferred to keep the typed client sound.
-- =============================================================================

CREATE TABLE public.recommendation_feedback (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id       TEXT         NOT NULL,                       -- localStorage uid()
  item_type       TEXT         NOT NULL CHECK (item_type IN ('food', 'exercise')),
  item_name       TEXT         NOT NULL,
  kind            TEXT         NOT NULL CHECK (kind IN ('accept', 'reject', 'favorite')),
  macro_highlight TEXT,                                        -- food only
  category        TEXT,                                        -- exercise only
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_type, item_name)
);

CREATE INDEX recommendation_feedback_user ON public.recommendation_feedback (user_id);

ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recommendation_feedback: user owns rows"
  ON public.recommendation_feedback FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

