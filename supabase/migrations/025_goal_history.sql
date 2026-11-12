-- =============================================================================
-- Diet Tracker — goal history + researcher-only consented_at (6-month study)
-- =============================================================================
-- Run AFTER 024_exercise_ranks.sql
--
-- 1. goal_history: append-only snapshots of a user's goal.
--    profiles holds only the CURRENT goal (overwritten on every save), so a
--    participant who changes their goal during the study would erase the goal
--    they started with. The 6-month outcomes (goal-weight attainment,
--    stratification by starting purpose — docs/trial/cohort-queries.sql) need
--    the goal as it was at enrolment.
--
--    Grain: one row per goal save that differs from the previous one on the
--    same device (lib/data/goal-history.ts dedupes client-side; a second
--    device can add a duplicate row, so analysis takes the EARLIEST row per
--    user, never a count).
--
--    Written at onboarding completion and on each settings save. goal_* are
--    NULLable: onboarding has no goal-weight step, and it can finish without
--    computed nutrition targets.
--
--    Append-only for users: INSERT + SELECT policies only, so there is no
--    user-scope UPDATE or DELETE. Rows go away with the account
--    (ON DELETE CASCADE from profiles — the self-delete path).
--
-- 2. profiles.consented_at becomes researcher-only.
--    Since 2026-10-14 there is no in-app consent screen (vault ADR-007):
--    consented_at means "the researcher has checked this person's signed paper
--    consent form" and is set by hand in the SQL editor
--    (docs/trial/consent-roster.sql). The UPDATE policy from 008 froze only
--    `role`, so a signed-in user could still set their own consented_at from
--    the browser and enter the study data set without a form. Freeze it the
--    same way. The SQL editor and the service role bypass RLS.
--
--    This migration does NOT clear existing consented_at values. Any value
--    present before the study starts was written by the removed in-app
--    screen (which said "not used for research") and must not count as
--    research consent: run R0 in docs/trial/consent-roster.sql before marking
--    the first participant. Production had 0 such rows on 2026-10-14.
--
-- No backfill of goal_history from profiles: study participants are new
-- accounts. An account created before this migration has no starting row and
-- is reported as 'no_goal'.
-- =============================================================================

-- ── 1. goal_history ──────────────────────────────────────────────────────────

CREATE TABLE public.goal_history (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recorded_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- NULL = the user has never actively chosen a purpose (the profile default
  -- 'maintenance' is not a choice); analysis takes the earliest non-NULL row.
  fitness_goal   TEXT
    CHECK (fitness_goal IN ('weight_loss','muscle_gain','maintenance','endurance','flexibility')),
  goal_weight_kg NUMERIC(5,1) CHECK (goal_weight_kg > 0),
  goal_calories  INTEGER      CHECK (goal_calories  > 0),
  goal_protein_g NUMERIC(6,1) CHECK (goal_protein_g >= 0),
  goal_fat_g     NUMERIC(6,1) CHECK (goal_fat_g     >= 0),
  goal_carbs_g   NUMERIC(6,1) CHECK (goal_carbs_g   >= 0)
);

CREATE INDEX goal_history_user_recorded ON public.goal_history (user_id, recorded_at);

ALTER TABLE public.goal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_history: user reads own rows"
  ON public.goal_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "goal_history: user inserts own rows"
  ON public.goal_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- The analysis orders by recorded_at to find the starting goal, and rows are
-- append-only for users, so a client must not be able to choose the
-- timestamp (or the id). Service-role / SQL-editor inserts are left alone.
CREATE OR REPLACE FUNCTION public.goal_history_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.id          := gen_random_uuid();
    NEW.recorded_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER goal_history_stamp_before_insert
  BEFORE INSERT ON public.goal_history
  FOR EACH ROW EXECUTE FUNCTION public.goal_history_stamp();

COMMENT ON TABLE public.goal_history IS
  'Append-only goal snapshots (onboarding completion + settings saves). Analysis uses the earliest row per user as the starting goal.';

-- ── 2. Freeze consented_at for user-scope writes ─────────────────────────────

DROP POLICY IF EXISTS "profiles: users update own row" ON public.profiles;

CREATE POLICY "profiles: users update own row"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND consented_at IS NOT DISTINCT FROM
        (SELECT consented_at FROM public.profiles WHERE id = auth.uid())
  );

COMMENT ON POLICY "profiles: users update own row" ON public.profiles IS
  'Users may update their own profile; role and consented_at are frozen — both are set by the researcher (SQL editor / service key).';

COMMENT ON COLUMN public.profiles.consented_at IS
  'Date the researcher confirmed this user''s signed paper consent form (set by hand, docs/trial/consent-roster.sql). NULL = no confirmed form; excluded from all analysis and research export.';
