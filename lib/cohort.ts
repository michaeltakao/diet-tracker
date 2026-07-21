/**
 * Study cohort assignment (FTUE roadmap P0 #10, automation half only).
 *
 * Pure/DI, same idiom as lib/notifications.ts: the RNG is injected so tests
 * are deterministic. Assignment itself is a coin flip — no stratification,
 * no balancing — the roadmap explicitly scopes bucket-balance verification
 * to manual SQL for this round (see supabase/migrations/019_sus_responses.sql
 * comment + app/api/consent/route.ts).
 *
 * Cohort is assigned once, at first consent, and never re-assigned
 * (app/api/consent/route.ts's existing 409-on-already-consented path already
 * makes consent idempotent; cohort assignment piggybacks on that guarantee).
 *
 * Behavioral branching on the assigned cohort (e.g. XAI why-badges for
 * xai_treatment) is explicitly OUT of scope for this round — this module
 * only decides and persists the label.
 */

export type StudyCohort = 'control' | 'xai_treatment';

/** Injectable random source — Math.random in production, fixed sequences in tests. */
export interface CohortRng {
  next(): number;
}

/** 50/50 split. next() in [0, 0.5) → control, [0.5, 1) → xai_treatment. */
export function assignCohort(rng: CohortRng): StudyCohort {
  return rng.next() < 0.5 ? 'control' : 'xai_treatment';
}
