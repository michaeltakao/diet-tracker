-- =============================================================================
-- Diet Tracker — Solo Leveling rank system, Phase 3: daily quests
-- =============================================================================
-- Run AFTER 020_user_ranks.sql
--
-- user_quests: one row per (user, date, quest_type). quest_type covers the
-- four base quests (meal/workout/water/weight, mirroring the badge system's
-- streak activity axes) plus all_complete (bonus for finishing all four in
-- one day). UNIQUE(user_id, quest_date, quest_type) makes recordQuestCompletion
-- idempotent — a second completion attempt for the same day/type upserts in
-- place rather than double-awarding XP.
-- =============================================================================

CREATE TABLE public.user_quests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quest_date   DATE        NOT NULL,
  quest_type   TEXT        NOT NULL CHECK (quest_type IN ('meal','workout','water','weight','all_complete')),
  completed    BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  xp_earned    INTEGER     NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  UNIQUE (user_id, quest_date, quest_type)
);
CREATE INDEX user_quests_user_date ON public.user_quests (user_id, quest_date);
ALTER TABLE public.user_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_quests: user owns rows"
  ON public.user_quests FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
