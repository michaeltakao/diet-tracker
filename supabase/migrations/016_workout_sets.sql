-- 016: Per-set workout logging + estimated-1RM PR persistence (phase B).
--
-- set_details: JSONB array of {weight, reps} (kg) — one element per working
-- set. Scalar sets/reps/weight_kg columns remain the derived summary (top
-- weight, its reps, set count) so every existing reader keeps working.
--
-- NOTE: this deliberately diverges from the redesign roadmap's normalized
-- workout_sets table (docs/roadmaps, engine phase): a JSONB column keeps the
-- 1:1 localStorage↔row dual-write mirror (ADR-007) — the client owns the
-- entry as a single document and mirrors it in one upsert. Revisit when the
-- deterministic engine needs relational set queries.

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS set_details JSONB;

-- Estimated 1RM (Epley, lib/onerm.ts) at the time the weight PR was set.
-- Weight PRs remain the celebration trigger; est_1rm is analytical.
ALTER TABLE public.personal_records
  ADD COLUMN IF NOT EXISTS est_1rm NUMERIC(6,1);
