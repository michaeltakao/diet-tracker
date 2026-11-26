/**
 * "Next step" for the home screen (UX P0, REDESIGN_PROPOSAL §2): exactly one
 * deterministic suggestion from today's state. No LLM, no streak-break
 * message (we do not punish a missed day).
 *
 * Priority:
 *   1. no real goals            → set goals
 *   2. the current main slot is empty, else the latest earlier empty one
 *                               → log that meal
 *   3. no weight today          → log weight
 *   4. otherwise                → done
 *
 * A main slot is "due" from its start time (JST): breakfast 00:00,
 * lunch 11:00, dinner 16:00. Snack is never suggested.
 */
import type { MealSlot } from './meal-slots';

export type NextAction =
  | { kind: 'set-goals' }
  | { kind: 'log-meal'; slot: MealSlot }
  | { kind: 'log-weight' }
  | { kind: 'done' };

export interface NextActionInput {
  hasGoals: boolean;
  /** Main slots with ≥1 entry today. */
  filledSlots: readonly MealSlot[];
  weightLoggedToday: boolean;
  /** JST wall clock, HH:MM. */
  nowJst: string;
}

const DUE_FROM: ReadonlyArray<readonly [MealSlot, number]> = [
  ['breakfast', 0],
  ['lunch', 11 * 60],
  ['dinner', 16 * 60],
];

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Main slots due at `nowJst`, latest first (current slot is index 0). */
export function dueSlots(nowJst: string): MealSlot[] {
  const now = minutes(nowJst);
  return DUE_FROM.filter(([, from]) => now >= from).map(([s]) => s).reverse();
}

export function nextAction(input: NextActionInput): NextAction {
  if (!input.hasGoals) return { kind: 'set-goals' };
  const missing = dueSlots(input.nowJst).find((s) => !input.filledSlots.includes(s));
  if (missing) return { kind: 'log-meal', slot: missing };
  if (!input.weightLoggedToday) return { kind: 'log-weight' };
  return { kind: 'done' };
}
