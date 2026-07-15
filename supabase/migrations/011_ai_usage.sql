-- =============================================================================
-- Diet Tracker — durable per-user daily AI usage quota (P0 #3)
-- =============================================================================
-- Run AFTER 010 (multi-generation round).
--
-- One row per (user, JST calendar day, AI route). The in-memory limiter in
-- lib/rate-limit.ts resets on every server restart; this table is the durable
-- layer that caps daily spend on the paid Gemini key. Read by guardAiRoute()
-- (fail-closed: quota-check DB error → 503) and written by recordAiUsage()
-- only after a successful Gemini call, so failed requests never consume quota.
--
-- usage_date  — JST ((now() AT TIME ZONE 'Asia/Tokyo')::date); the TS side
--               computes the same day string. Quotas reset at midnight JST.
-- calls       — successful AI calls charged to this (user, day, route).
-- est_tokens  — best-effort token accounting from the SDK's usageMetadata;
--               0 when unavailable. For cost analysis only, not enforcement.
--
-- Authenticated users only: user_id FKs to profiles(id), so IP-keyed rows are
-- impossible. Guests remain covered by APP_ACCESS_CODE + the in-memory limiter.
-- NOTE: accounts predating migration 009's consent repair may lack a profiles
-- row; for them the FK makes increment_ai_usage fail, recordAiUsage swallows
-- it, and they are effectively unmetered until the repair path backfills the
-- profile (acceptable — P0 #1 shipped the repair in e7852dc).
-- =============================================================================

CREATE TABLE public.ai_usage (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  usage_date DATE        NOT NULL,
  route      TEXT        NOT NULL,
  calls      INTEGER     NOT NULL DEFAULT 0,
  est_tokens BIGINT      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, usage_date, route)
);

CREATE INDEX ai_usage_user_date ON public.ai_usage (user_id, usage_date DESC);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage: user owns rows"
  ON public.ai_usage FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Atomic increment: INSERT … ON CONFLICT DO UPDATE is not expressible through
-- supabase-js, so routes call this via .rpc(). SECURITY DEFINER with a pinned
-- empty search_path; user_id comes from auth.uid(), so a caller can only ever
-- increment their own row. anon/PUBLIC cannot execute it at all.
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_route TEXT, p_est_tokens BIGINT DEFAULT 0)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.ai_usage (user_id, usage_date, route, calls, est_tokens)
  VALUES (auth.uid(), (now() AT TIME ZONE 'Asia/Tokyo')::date, p_route, 1, COALESCE(p_est_tokens, 0))
  ON CONFLICT (user_id, usage_date, route)
  DO UPDATE SET calls      = public.ai_usage.calls + 1,
                est_tokens = public.ai_usage.est_tokens + COALESCE(p_est_tokens, 0),
                updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.increment_ai_usage(TEXT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(TEXT, BIGINT) TO authenticated;
