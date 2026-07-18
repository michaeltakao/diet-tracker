import { describe, it, expect } from 'vitest';
import { EXERCISE_DB, getExercises, findExercise } from '@/lib/exercise-db';
import type { MusclePart } from '@/lib/types';

const PARTS: MusclePart[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs'];

describe('EXERCISE_DB', () => {
  it('has exactly 10 exercises per muscle part (60 total)', () => {
    expect(EXERCISE_DB.length).toBe(60);
    for (const part of PARTS) {
      expect(getExercises(part).length, part).toBe(10);
    }
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

  it('carries the 12 former RECOMMENDED_MENUS as `recommended` (2 per part)', () => {
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
    expect(all.length).toBe(60);
    all.pop();
    expect(EXERCISE_DB.length).toBe(60); // original untouched
  });
});
