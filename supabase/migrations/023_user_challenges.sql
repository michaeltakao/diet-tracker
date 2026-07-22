-- =============================================================================
-- Diet Tracker — Shadow Training Grounds: daily bodyweight challenge
-- =============================================================================
-- Run AFTER 021_user_quests.sql (same table pattern)
--
-- user_challenges: one row per (user, JST date). challenge_type is the
-- deterministic daily pick (lib/daily-challenge.ts hashes the JST date into
-- the 6-entry pool — no cron, no server randomness). UNIQUE(user_id,
-- challenge_date) makes recordChallengeCompletion idempotent — a retry
-- upserts in place rather than double-recording the day.
-- =============================================================================

CREATE TABLE public.user_challenges (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_date DATE        NOT NULL,
  challenge_type TEXT        NOT NULL CHECK (challenge_type IN ('pushup_100','squat_150','plank_180','lunge_80','burpee_50','mountain_60')),
  xp_earned      INTEGER     NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  completed_at   TIMESTAMPTZ,
  UNIQUE (user_id, challenge_date)
);
CREATE INDEX user_challenges_user_date ON public.user_challenges (user_id, challenge_date);
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_challenges: user owns rows"
  ON public.user_challenges FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
