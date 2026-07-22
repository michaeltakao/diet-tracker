/**
 * Shadow Training Grounds — daily bodyweight challenge, pure logic. Same
 * shape as lib/daily-quests.ts: given a data snapshot and a date, derive
 * the challenge state; the dual-write caller (lib/data/daily-challenge.ts)
 * decides what's newly-completed and persists it.
 *
 * One challenge per JST day, picked DETERMINISTICALLY from a fixed pool by
 * hashing the date string — every device agrees on today's challenge with
 * no cron, no server, no Math.random (same client-side-derived idiom as
 * streaks and weekly challenges).
 */

import type { WorkoutEntry } from './types';

export type ChallengeType =
  | 'pushup_100'
  | 'squat_150'
  | 'plank_180'
  | 'lunge_80'
  | 'burpee_50'
  | 'mountain_60';

export const DAILY_CHALLENGE_XP = 30;

export interface ChallengeDef {
  type: ChallengeType;
  /** Total reps to hit today (for plank: seconds — reps-as-seconds is the exercise-db plank convention). */
  target: number;
  /** Lowercased substrings matched against entry names (ja + en). Generous by design — weighted variants count. */
  keywords: string[];
}

export const CHALLENGE_POOL: ChallengeDef[] = [
  { type: 'pushup_100',  target: 100, keywords: ['腕立て', 'push-up', 'pushup', 'push up'] },
  { type: 'squat_150',   target: 150, keywords: ['スクワット', 'squat'] },
  { type: 'plank_180',   target: 180, keywords: ['プランク', 'plank'] },
  { type: 'lunge_80',    target: 80,  keywords: ['ランジ', 'lunge'] },
  { type: 'burpee_50',   target: 50,  keywords: ['バーピー', 'burpee'] },
  { type: 'mountain_60', target: 60,  keywords: ['マウンテンクライマー', 'mountain climber'] },
];

/** Deterministic non-negative hash of a YYYY-MM-DD string (Σ charCode×31ⁱ, kept in uint32 range). */
export function hashDate(date: string): number {
  let h = 0;
  for (let i = 0; i < date.length; i++) {
    h = (h * 31 + date.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Today's challenge — same date always yields the same pick, on every device. */
export function getChallengeForDate(date: string): ChallengeDef {
  return CHALLENGE_POOL[hashDate(date) % CHALLENGE_POOL.length];
}

/**
 * Total reps logged toward `def` on `date`. An entry counts iff its date
 * matches AND its lowercased name contains any keyword (substring match —
 * バーベルスクワット counts toward squat_150; accepted design). Per-entry
 * reps: sum of setDetails reps when present (the scalar `reps` is top-set
 * only — see lib/workout-sets.ts header), else reps × sets.
 */
export function countChallengeReps(
  entries: ReadonlyArray<WorkoutEntry>,
  def: ChallengeDef,
  date: string,
): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.date !== date) continue;
    const name = entry.name.toLowerCase();
    if (!def.keywords.some((k) => name.includes(k))) continue;
    total += entry.setDetails?.length
      ? entry.setDetails.reduce((sum, s) => sum + s.reps, 0)
      : (entry.reps ?? 0) * (entry.sets ?? 0);
  }
  return total;
}

export interface DailyChallengeProgress {
  challenge: ChallengeDef;
  current: number;
  completed: boolean;
}

/** Challenge + progress for `date` from the given workout entries. Pure. */
export function getDailyChallengeProgress(
  entries: ReadonlyArray<WorkoutEntry>,
  date: string,
): DailyChallengeProgress {
  const challenge = getChallengeForDate(date);
  const current = countChallengeReps(entries, challenge, date);
  return { challenge, current, completed: current >= challenge.target };
}
