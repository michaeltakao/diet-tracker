/**
 * Study cohort assignment (FTUE roadmap P0 #10, automation half only).
 *
 * Pure/DI, same idiom as lib/notifications.ts: the RNG is injected so tests
 * are deterministic. Assignment itself is a coin flip — no stratification,
 * no balancing — the roadmap explicitly scopes bucket-balance verification
 * to manual SQL for this round (see supabase/migrations/019_sus_responses.sql
 * comment).
 *
 * NOT CALLED since 2026-10-14: the only caller was POST /api/consent, removed
 * with the in-app consent screen (vault ADR-007). profiles.study_cohort stays
 * NULL for users who join after that date; the 6-month study has no arms.
 * Kept (with its tests) for a later controlled study.
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
