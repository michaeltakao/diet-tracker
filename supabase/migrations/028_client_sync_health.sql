-- =============================================================================
-- Diet Tracker — per-open sync health rows (vault ADR-008 P0-6)
-- =============================================================================
-- Run AFTER 027_build_stamp.sql
--
-- food / weight / workout writes now go through an IndexedDB outbox on the
-- device (lib/data/outbox.ts): failed sends are kept and retried instead of
-- being lost silently. Once per app open the client inserts one row here
-- with the counters accumulated since its last successful report:
--
--   synced_count      items sent successfully
--   failed_count      send attempts that failed transiently (kept, retried)
--   dropped_count     items dropped after a permanent error (constraint /
--                     type / schema) — data that did NOT reach the server
--   superseded_count  queued weights skipped because the server already had
--                     a newer value for that date (last-write-wins)
--   queued_count      items still waiting on the device at report time
--   oldest_queued_at  when the oldest of those was queued
--
-- Analysis use: per participant, dropped_count > 0 or a queued_count that
-- stays > 0 means their Supabase rows are incomplete; report it, and do not
-- read missing days for that participant as non-use.
--
-- Client-supplied counts (RLS lets a user insert only their own rows), so
-- this is a diagnostic, not an audit trail. Insert-only for clients: no
-- update / delete policy. Additive; nothing reads it in the app.
-- =============================================================================

CREATE TABLE public.client_sync_health (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_count      INTEGER     NOT NULL DEFAULT 0 CHECK (synced_count >= 0),
  failed_count      INTEGER     NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  dropped_count     INTEGER     NOT NULL DEFAULT 0 CHECK (dropped_count >= 0),
  superseded_count  INTEGER     NOT NULL DEFAULT 0 CHECK (superseded_count >= 0),
  queued_count      INTEGER     NOT NULL DEFAULT 0 CHECK (queued_count >= 0),
  oldest_queued_at  TIMESTAMPTZ NULL,
  build_sha         TEXT        NULL,
  study_build       BOOLEAN     NULL
);

CREATE INDEX client_sync_health_user_reported_idx
  ON public.client_sync_health (user_id, reported_at DESC);

ALTER TABLE public.client_sync_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_sync_health: user inserts own rows"
  ON public.client_sync_health FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "client_sync_health: user reads own rows"
  ON public.client_sync_health FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.client_sync_health IS
  'One row per app open: outbox counters since the last report (lib/data/outbox.ts, ADR-008 P0-6). Diagnostic, client-supplied.';
