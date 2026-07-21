-- =============================================================================
-- Diet Tracker — Solo Leveling rank system, Phase 4: title system
-- =============================================================================
-- Run AFTER 021_user_quests.sql
--
-- user_titles: earned titles, once-ever (UNIQUE user_id+title_key, same
-- once-earned-never-revoked semantics as the badges table). title_key is a
-- stable identifier (lib/titles.ts TitleKey); display_name is denormalized
-- at award time so historical rows read correctly even if a future copy
-- update changes the live display string.
-- =============================================================================

CREATE TABLE public.user_titles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title_key    TEXT        NOT NULL,
  awarded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  display_name TEXT        NOT NULL,
  UNIQUE (user_id, title_key)
);
ALTER TABLE public.user_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_titles: user owns rows"
  ON public.user_titles FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
