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
