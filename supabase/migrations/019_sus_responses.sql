-- =============================================================================
-- Diet Tracker — SUS survey responses + beta feedback + cohort CHECK (FTUE
-- roadmap P0 #10 cohort/SUS gate, §12 beta-gate feedback channel)
-- =============================================================================
-- Run AFTER 018_lifestyle.sql
--
-- sus_responses: one standard System Usability Scale (10-item, 1-5 Likert)
-- submission per user, surfaced by components/SusSurveyCard.tsx from Day 14
-- onward (lib/sus-gate.ts). total_score is computed server-side (lib/sus.ts)
-- from the validated item scores — never trust a client-submitted total.
--
-- beta_feedback: free-text feedback/bug reports. Anonymous (guest) submission
-- is allowed by product design (Workstream 6) — user_id is nullable and
-- ON DELETE SET NULL (not CASCADE): feedback content outlives the account
-- that filed it, for research/product continuity, even after self-deletion.
--
-- study_cohort CHECK: profiles.study_cohort has existed since 007_research_
-- roles.sql with no constraint; this pins it to the two values the FTUE
-- roadmap's cohort assignment (lib/cohort.ts) ever writes.
-- =============================================================================

CREATE TABLE public.sus_responses (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_1       SMALLINT    NOT NULL CHECK (item_1  BETWEEN 1 AND 5),
  item_2       SMALLINT    NOT NULL CHECK (item_2  BETWEEN 1 AND 5),
  item_3       SMALLINT    NOT NULL CHECK (item_3  BETWEEN 1 AND 5),
  item_4       SMALLINT    NOT NULL CHECK (item_4  BETWEEN 1 AND 5),
  item_5       SMALLINT    NOT NULL CHECK (item_5  BETWEEN 1 AND 5),
  item_6       SMALLINT    NOT NULL CHECK (item_6  BETWEEN 1 AND 5),
  item_7       SMALLINT    NOT NULL CHECK (item_7  BETWEEN 1 AND 5),
  item_8       SMALLINT    NOT NULL CHECK (item_8  BETWEEN 1 AND 5),
  item_9       SMALLINT    NOT NULL CHECK (item_9  BETWEEN 1 AND 5),
  item_10      SMALLINT    NOT NULL CHECK (item_10 BETWEEN 1 AND 5),
  total_score  NUMERIC(5,2) NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.sus_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sus_responses: user owns rows"
  ON public.sus_responses FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.beta_feedback (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  message    TEXT        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  page_path  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX beta_feedback_user ON public.beta_feedback (user_id);

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

-- Owner-only for authenticated reads/writes of their own rows. Guest (no-
-- session) inserts never go through this RLS path — app/api/feedback/route.ts
-- uses the service-role client for unauthenticated submissions, since
-- auth.uid() is NULL for guests and would fail WITH CHECK below regardless.
CREATE POLICY "beta_feedback: user owns rows"
  ON public.beta_feedback FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_study_cohort_check
  CHECK (study_cohort IS NULL OR study_cohort IN ('control', 'xai_treatment'));
