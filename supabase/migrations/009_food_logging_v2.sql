-- =============================================================================
-- Diet Tracker — Food logging v2 (portion scaling, favorites, meal templates)
-- =============================================================================
-- Run AFTER 008_research_hardening.sql
--
-- 1. food_logs: nullable portion/provenance columns. Stored kcal/P/F/C stay
--    FINAL consumed values — these columns are metadata only, so nothing
--    downstream (TDEE, reports, streaks) changes. sodium_mg/fiber_g are
--    future-proofing: lib/medication-rules.ts already reasons about sodium
--    (no UI/prompt change this round).
--
-- 2. favorite_foods: explicit ♡ favorites. One row per (user, name); also
--    mirrored into recommendation_feedback client-side as the Phase B
--    W_FAVORITE signal.
--
-- 3. meal_templates: saved meals for one-tap re-log. Items are a JSONB array
--    of { name, calories, protein, fat, carbs } (schema-light: templates are
--    a client convenience, not an analytical table).
--
-- RLS follows the owner pattern from migration 006; FK ON DELETE CASCADE from
-- profiles keeps the self-delete erasure (W4) complete.
-- =============================================================================


-- ── 1. food_logs portion metadata ─────────────────────────────────────────────

ALTER TABLE public.food_logs
  ADD COLUMN IF NOT EXISTS servings     NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS serving_unit TEXT,
  ADD COLUMN IF NOT EXISTS amount_g     NUMERIC(7,1),
  ADD COLUMN IF NOT EXISTS source       TEXT
    CHECK (source IN ('manual', 'ai', 'db', 'barcode')),
  ADD COLUMN IF NOT EXISTS source_id    TEXT,
  ADD COLUMN IF NOT EXISTS sodium_mg    NUMERIC(7,1),
  ADD COLUMN IF NOT EXISTS fiber_g      NUMERIC(6,1);

COMMENT ON COLUMN public.food_logs.servings IS
  'Portion multiplier applied at entry time; calories/macros are already final.';
COMMENT ON COLUMN public.food_logs.source IS
  'Provenance of nutrition values: manual | ai (photo) | db (bundled food DB) | barcode.';


-- ── 2. favorite_foods ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.favorite_foods (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT         NOT NULL,
  calories        NUMERIC(7,1) NOT NULL,
  protein_g       NUMERIC(6,1) NOT NULL,
  fat_g           NUMERIC(6,1) NOT NULL,
  carbs_g         NUMERIC(6,1) NOT NULL,
  macro_highlight TEXT         NOT NULL DEFAULT '',
  source_id       TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS favorite_foods_user
  ON public.favorite_foods (user_id, created_at DESC);

ALTER TABLE public.favorite_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorite_foods: user owns rows"
  ON public.favorite_foods FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── 3. meal_templates ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meal_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  meal_type  meal_type   NOT NULL,
  items      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meal_templates_user
  ON public.meal_templates (user_id, created_at DESC);

ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_templates: user owns rows"
  ON public.meal_templates FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
