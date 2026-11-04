-- =============================================================================
-- Diet Tracker — researcher-only study day 0 (vault ADR-008 P0-9)
-- =============================================================================
-- Run AFTER 025_goal_history.sql
--
-- profiles.study_start_at: the moment this participant's 6-month study
-- window starts. docs/trial/cohort-queries.sql uses its JST date as day 0.
--
-- Until now day 0 was profiles.created_at (first sign-in). That is wrong for
-- anyone whose account predates the study — the family-trial carry-overs —
-- because their trial-era rows (UTC-dated before P0-1, onboarding defaults
-- before P0-5) would land inside "month 1" and their w0 would be a trial
-- weight. ADR-008's default rule is to analyse only rows dated on/after
-- study_start_at.
--
-- Set by hand in the SQL editor together with consented_at
-- (docs/trial/consent-roster.sql R2): greatest(signature date at 12:00 JST,
-- created_at), adjustable per person (e.g. the day the URL was handed over).
-- NULL = not (yet) a study participant; every cohort query requires it.
--
-- Frozen for user-scope writes exactly like role and consented_at (025): a
-- signed-in user could otherwise move their own day 0 from the browser. The
-- SQL editor and the service role bypass RLS. INSERT needs no change —
-- profiles rows are created only by the SECURITY DEFINER handle_new_user()
-- trigger (001), which does not set this column.
--
-- Additive, nullable, no backfill: nobody is a participant yet.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN study_start_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.profiles.study_start_at IS
  'Start of this participant''s 6-month study window, set by the researcher with consented_at (docs/trial/consent-roster.sql). Its Asia/Tokyo date is day 0 in docs/trial/cohort-queries.sql. NULL = not a study participant.';

DROP POLICY IF EXISTS "profiles: users update own row" ON public.profiles;

CREATE POLICY "profiles: users update own row"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND consented_at IS NOT DISTINCT FROM
        (SELECT consented_at FROM public.profiles WHERE id = auth.uid())
    AND study_start_at IS NOT DISTINCT FROM
        (SELECT study_start_at FROM public.profiles WHERE id = auth.uid())
  );

COMMENT ON POLICY "profiles: users update own row" ON public.profiles IS
  'Users may update their own profile; role, consented_at and study_start_at are frozen — all three are set by the researcher (SQL editor / service key).';
