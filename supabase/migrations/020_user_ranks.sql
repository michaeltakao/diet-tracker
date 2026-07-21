-- =============================================================================
-- Diet Tracker — Solo Leveling rank system, Phase 1: XP/rank foundation
-- =============================================================================
-- Run AFTER 019_sus_responses.sql
--
-- user_ranks: one row per user holding cumulative XP and the highest rank
-- ever reached. total_xp is monotonic non-decreasing (XP is never spent or
-- removed by deleting logs — see lib/xp.ts addXp). highest_rank is a
-- separately-tracked ratchet distinct from the rank implied by current XP
-- (lib/rank.ts getRankForXp), mirroring the existing badge system's
-- once-earned-never-revoked semantics (hasBadge()).
--
-- TEXT CHECK enum (not a Postgres ENUM type) to match the 019_sus_responses.sql
-- / earlier migrations' convention of avoiding schema type proliferation.
-- =============================================================================

CREATE TABLE public.user_ranks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_xp      INTEGER     NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  highest_rank  TEXT        NOT NULL DEFAULT 'E' CHECK (highest_rank IN ('E','D','C','B','A','S')),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_ranks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_ranks: user owns rows"
  ON public.user_ranks FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
