-- =============================================================================
-- Diet Tracker — Research hardening (security + data quality)
-- =============================================================================
-- Run AFTER 007_research_roles.sql
--
-- Three changes driven by pre-migration security review (2026-06-22):
--
-- 1. SECURITY — Prevent role self-elevation via profiles UPDATE policy.
--    Migration 007 added profiles.role without restricting who can write it.
--    The existing "profiles: users update own row" policy (migration 001) allows
--    any authenticated user to UPDATE their own profile, including the role col.
--    Fix: replace the policy with one that freezes the role column for user-scope
--    writes. Role changes must go through the Supabase dashboard or a
--    service-key Edge Function.
--
-- 2. DATA QUALITY — Remove UNIQUE constraint from recommendation_feedback.
--    The UNIQUE (user_id, item_type, item_name) constraint (migration 005) causes
--    upsert to overwrite earlier reactions. This destroys preference-change
--    history — a core research data source. Removing the constraint allows
--    INSERT-only writes so temporal dynamics are preserved.
--
-- 3. RESEARCH COMPLIANCE — researcher_access_log table for IRB audit trail.
--    Every call to /api/research/participants or /api/research/export must be
--    logged. The table is insert-only for authenticated roles (reads restricted
--    to the researcher who made the call).
--
-- 4. PERFORMANCE — Partial index on profiles for researcher participant query.
--    Covers the common filter pattern: role='participant' AND consented_at IS NOT NULL.
-- =============================================================================


-- ── 1. Role-freeze policy on profiles ────────────────────────────────────────

-- Drop the permissive UPDATE policy created in migration 001.
DROP POLICY IF EXISTS "profiles: users update own row" ON public.profiles;

-- Replacement: users may update their own row, but the role column must not
-- change. The WITH CHECK subquery reads the current role from the SAME row
-- (pre-update snapshot visible within the same statement) to compare against
-- the proposed NEW value.
CREATE POLICY "profiles: users update own row"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

COMMENT ON POLICY "profiles: users update own row" ON public.profiles IS
  'Users may update their own profile; role is frozen — changes must use the service key.';


-- ── 2. Drop UNIQUE constraint from recommendation_feedback ────────────────────

-- Find and drop the constraint by its likely name (Postgres names it
-- <table>_<cols>_key by default). Use DROP CONSTRAINT IF EXISTS so the
-- migration is idempotent if the constraint was already removed.
ALTER TABLE public.recommendation_feedback
  DROP CONSTRAINT IF EXISTS recommendation_feedback_user_id_item_type_item_name_key;

-- If the constraint was created with a non-default name, this covers that case:
DO $$
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'public.recommendation_feedback'::regclass
    AND contype = 'u'
    AND array_to_string(
          ARRAY(
            SELECT attname FROM pg_attribute
            WHERE attrelid = conrelid
              AND attnum = ANY(conkey)
            ORDER BY attnum
          ),
          ','
        ) = 'item_name,item_type,user_id';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.recommendation_feedback DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

COMMENT ON TABLE public.recommendation_feedback IS
  'INSERT-only after migration 008: duplicate rows are allowed to preserve preference-change history.';


-- ── 3. Researcher access audit log ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.researcher_access_log (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  researcher_id  UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint       TEXT         NOT NULL,
  accessed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  filter_user_id UUID,          -- NULL = all participants
  table_name     TEXT           -- for /export calls
);

CREATE INDEX IF NOT EXISTS researcher_access_log_researcher_date
  ON public.researcher_access_log (researcher_id, accessed_at DESC);

ALTER TABLE public.researcher_access_log ENABLE ROW LEVEL SECURITY;

-- Researchers may only read their own access log
CREATE POLICY "researcher_access_log: researcher sees own entries"
  ON public.researcher_access_log FOR SELECT
  USING (auth.uid() = researcher_id);

-- INSERT is service-role only — no user-facing insert policy.
-- The route handlers use createServiceSupabase() to write audit rows.

COMMENT ON TABLE public.researcher_access_log IS
  'IRB audit trail: every researcher-scoped API call is logged here via the service role.';


-- ── 4. Partial index for participant query at scale ───────────────────────────

CREATE INDEX IF NOT EXISTS profiles_consented_participants
  ON public.profiles (consented_at DESC)
  WHERE role = 'participant' AND consented_at IS NOT NULL;

COMMENT ON INDEX profiles_consented_participants IS
  'Covers GET /api/research/participants: role=participant, consented_at IS NOT NULL, ordered by consent date.';
