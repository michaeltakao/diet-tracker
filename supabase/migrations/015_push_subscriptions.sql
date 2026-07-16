-- =============================================================================
-- Diet Tracker — Web Push subscriptions + send dedupe log (FTUE P0 #7, 2nd half)
-- =============================================================================
-- Run AFTER 014_symptoms.sql
--
-- push_subscriptions: one row per browser push endpoint. `endpoint` is UNIQUE
-- across users — a shared-device account switch rebinds the row to the new
-- session's user (server upserts ON CONFLICT (endpoint) with service role;
-- user_id always comes from the verified session, never the request body).
--
-- push_send_log: enforces "max 1 nudge per JST day" server-side and atomically
-- via PRIMARY KEY (user_id, sent_date) — the client-side localStorage marker is
-- courtesy only, the endpoint is curl-able. sent_date is the JST calendar day.
-- =============================================================================

CREATE TABLE public.push_subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL UNIQUE,
  keys_auth   TEXT        NOT NULL,
  keys_p256dh TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX push_subscriptions_user ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions: user owns rows"
  ON public.push_subscriptions FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.push_send_log (
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_date  DATE        NOT NULL,             -- JST day
  kind       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, sent_date)
);

ALTER TABLE public.push_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_send_log: user owns rows"
  ON public.push_send_log FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
