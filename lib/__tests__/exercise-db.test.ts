import { describe, it, expect } from 'vitest';
import { EXERCISE_DB, getExercises, findExercise, type MovementPattern } from '@/lib/exercise-db';
import type { MusclePart } from '@/lib/types';

const PARTS: MusclePart[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs'];
const MIN_TOTAL = 200;
const MIN_PER_PART = 15;

const MOVEMENT_PATTERNS: MovementPattern[] = [
  'squat', 'hinge', 'h-push', 'v-push', 'h-pull', 'v-pull', 'lunge', 'carry', 'core', 'isolation',
];

// The original phase-B 60 ids (nameJa/id frozen — history + PRs are keyed by
// nameJa in production). Used only to assert the pattern backfill covered
// every legacy entry; never assert against nameJa/id values changing here.
const LEGACY_60_IDS = [
  'bench-press', 'dumbbell-fly', 'incline-dumbbell-press', 'incline-bench-press', 'chest-press-machine',
  'pec-deck', 'cable-crossover', 'push-up', 'dips', 'dumbbell-pullover',
  'lat-pulldown', 'deadlift', 'bent-over-row', 'one-arm-dumbbell-row', 'pull-up',
  'seated-cable-row', 't-bar-row', 'back-extension', 'dumbbell-shrug', 'straight-arm-pulldown',
  'barbell-squat', 'leg-press', 'lunge', 'leg-extension', 'leg-curl',
  'romanian-deadlift', 'bulgarian-split-squat', 'goblet-squat', 'hip-thrust', 'calf-raise',
  'shoulder-press', 'side-raise', 'overhead-press', 'front-raise', 'rear-delt-fly',
  'upright-row', 'face-pull', 'arnold-press', 'machine-shoulder-press', 'pike-push-up',
  'arm-curl', 'triceps-pressdown', 'barbell-curl', 'hammer-curl', 'incline-dumbbell-curl',
  'skull-crusher', 'overhead-triceps-extension', 'cable-curl', 'close-grip-bench-press', 'triceps-kickback',
  'crunch', 'plank', 'leg-raise', 'russian-twist', 'ab-roller',
  'hanging-leg-raise', 'cable-crunch', 'bicycle-crunch', 'side-plank', 'mountain-climber',
] as const;

describe('EXERCISE_DB', () => {
  it('has at least 200 exercises, with a sane minimum per muscle part', () => {
    expect(EXERCISE_DB.length).toBeGreaterThanOrEqual(MIN_TOTAL);
    for (const part of PARTS) {
      expect(getExercises(part).length, part).toBeGreaterThanOrEqual(MIN_PER_PART);
    }
    // Every entry belongs to exactly one of the 6 parts.
    const sum = PARTS.reduce((n, p) => n + getExercises(p).length, 0);
    expect(sum).toBe(EXERCISE_DB.length);
  });

  it('has unique ids and unique canonical Japanese names', () => {
    const ids = EXERCISE_DB.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const jaNames = EXERCISE_DB.map((e) => e.nameJa);
    expect(new Set(jaNames).size).toBe(jaNames.length);
  });

  it('every entry has complete ja+en names and a valid equipment tag', () => {
    const equipment = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];
    for (const e of EXERCISE_DB) {
      expect(e.nameJa.length, e.id).toBeGreaterThan(0);
      expect(e.nameEn.length, e.id).toBeGreaterThan(0);
      expect(equipment, e.id).toContain(e.equipment);
    }
  });

  it('every entry has a valid movement pattern when present', () => {
    for (const e of EXERCISE_DB) {
      if (e.pattern !== undefined) {
        expect(MOVEMENT_PATTERNS, e.id).toContain(e.pattern);
      }
    }
  });

  it('the original 60 legacy entries all carry a movement pattern (backfilled)', () => {
    expect(LEGACY_60_IDS.length).toBe(60);
    for (const id of LEGACY_60_IDS) {
      const e = findExercise(id);
      expect(e, id).toBeDefined();
      expect(e!.pattern, id).toBeDefined();
    }
  });

  it('carries the 12 former RECOMMENDED_MENUS as `recommended` (2 per part), unchanged', () => {
    const rec = EXERCISE_DB.filter((e) => e.recommended);
    expect(rec.length).toBe(12);
    for (const part of PARTS) {
      expect(rec.filter((e) => e.musclePart === part).length, part).toBe(2);
    }
    // Spot-check a legacy menu survived verbatim (canonical name + defaults).
    const bench = findExercise('bench-press')!;
    expect(bench.nameJa).toBe('ベンチプレス');
    expect(bench.recommended).toMatchObject({ sets: 3, reps: 10, defaultWeightKg: 40 });
    expect(bench.recommended!.coachTipJa).toContain('大胸筋');
    expect(bench.recommended!.coachTipEn.length).toBeGreaterThan(0);
  });

  it('findExercise returns undefined for unknown ids', () => {
    expect(findExercise('nope')).toBeUndefined();
  });

  it('getExercises() without a part returns a copy of everything', () => {
    const all = getExercises();
    const originalLength = EXERCISE_DB.length;
    expect(all.length).toBe(originalLength);
    all.pop();
    expect(EXERCISE_DB.length).toBe(originalLength); // original untouched
  });
});
