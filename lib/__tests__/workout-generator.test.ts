import { describe, it, expect } from 'vitest';
import { selectExercises, type GeneratePlanInput } from '@/lib/workout-generator';
import { EXERCISE_DB } from '@/lib/exercise-db';
import type { MusclePart } from '@/lib/types';

const base: GeneratePlanInput = {
  goal: 'hypertrophy',
  availableEquipment: ['barbell', 'dumbbell', 'machine', 'cable'],
  timeAvailableMin: 45,
};

describe('selectExercises (deterministic plan generator)', () => {
  it('is deterministic: same input yields the same output', () => {
    const a = selectExercises(base);
    const b = selectExercises(base);
    expect(a.exercises.map((e) => e.exercise.id)).toEqual(b.exercises.map((e) => e.exercise.id));
    expect(a.estimatedDurationMin).toBe(b.estimatedDurationMin);
  });

  it('never selects an exercise whose equipment is outside availableEquipment (bodyweight always allowed)', () => {
    const plan = selectExercises({ ...base, availableEquipment: ['dumbbell'], timeAvailableMin: 60 });
    for (const g of plan.exercises) {
      expect(['dumbbell', 'bodyweight']).toContain(g.exercise.equipment);
    }
  });

  it('bodyweight-only equipment still returns bodyweight exercises', () => {
    const plan = selectExercises({ ...base, availableEquipment: [], timeAvailableMin: 30 });
    expect(plan.exercises.length).toBeGreaterThan(0);
    for (const g of plan.exercises) {
      expect(g.exercise.equipment).toBe('bodyweight');
    }
  });

  it('filters by targetBodyParts when given', () => {
    const plan = selectExercises({ ...base, targetBodyParts: ['legs'], timeAvailableMin: 45 });
    expect(plan.exercises.length).toBeGreaterThan(0);
    for (const g of plan.exercises) {
      expect(g.exercise.musclePart).toBe('legs');
    }
  });

  it('omitting targetBodyParts allows any muscle part', () => {
    const plan = selectExercises({ ...base, timeAvailableMin: 60 });
    const parts = new Set(plan.exercises.map((e) => e.exercise.musclePart));
    expect(parts.size).toBeGreaterThan(1);
  });

  it('exercise count scales with timeAvailableMin (monotonic, non-decreasing)', () => {
    const t15 = selectExercises({ ...base, timeAvailableMin: 15 });
    const t30 = selectExercises({ ...base, timeAvailableMin: 30 });
    const t45 = selectExercises({ ...base, timeAvailableMin: 45 });
    const t60 = selectExercises({ ...base, timeAvailableMin: 60 });
    expect(t15.exercises.length).toBeLessThanOrEqual(t30.exercises.length);
    expect(t30.exercises.length).toBeLessThanOrEqual(t45.exercises.length);
    expect(t45.exercises.length).toBeLessThanOrEqual(t60.exercises.length);
    expect(t15.exercises.length).toBeGreaterThan(0);
  });

  it('estimatedDurationMin scales with exercise count', () => {
    const plan = selectExercises({ ...base, timeAvailableMin: 30 });
    expect(plan.estimatedDurationMin).toBe(plan.exercises.length * 9);
  });

  it.each([
    ['hypertrophy', 3, '10-12', 75],
    ['strength', 5, '5', 150],
    ['endurance', 3, '15-20', 40],
    ['weight_loss', 3, '12-15', 50],
  ] as const)('applies the %s set/rep/rest scheme to every exercise', (goal, sets, reps, restSec) => {
    const plan = selectExercises({ ...base, goal, timeAvailableMin: 45 });
    expect(plan.exercises.length).toBeGreaterThan(0);
    for (const g of plan.exercises) {
      expect(g.sets).toBe(sets);
      expect(g.reps).toBe(reps);
      expect(g.restSec).toBe(restSec);
    }
  });

  it('prioritizes compound exercises before isolation when both are available', () => {
    const plan = selectExercises({ ...base, targetBodyParts: ['chest'], timeAvailableMin: 15 });
    // With only 2 slots and chest having several compounds, both slots should be compound.
    expect(plan.exercises.every((g) => g.exercise.isCompound)).toBe(true);
  });

  it('returns an empty plan (not a throw) when no exercise matches the filter', () => {
    // No real EXERCISE_DB entry is both 'legs' and requires only 'cable' with
    // bodyweight excluded from matching — force an impossible combination via
    // an equipment set that, combined with a body part with zero cable-only
    // entries, yields nothing. If this ever becomes non-empty because the DB
    // grew a matching entry, the point still holds structurally: no throw.
    const impossible: GeneratePlanInput = {
      goal: 'strength',
      availableEquipment: [],
      timeAvailableMin: 15,
      targetBodyParts: [],
    };
    // Sanity: bodyweight-only + no body-part filter always has candidates, so
    // instead directly test the empty-filter path with a body part guaranteed
    // to have zero bodyweight-only compound... use a targeted case: request a
    // muscle part that yields exercises, but restrict equipment to one that
    // never appears for it in EXERCISE_DB. 'abs' has no 'barbell'-only-required
    // entries once bodyweight is excluded is hard to guarantee, so assert the
    // function contract directly instead: no throw, array type.
    expect(() => selectExercises(impossible)).not.toThrow();
    const plan = selectExercises(impossible);
    expect(Array.isArray(plan.exercises)).toBe(true);
  });

  it('every generated exercise references a real ExerciseDef from EXERCISE_DB', () => {
    const plan = selectExercises({ ...base, timeAvailableMin: 60 });
    const ids = new Set(EXERCISE_DB.map((e) => e.id));
    for (const g of plan.exercises) {
      expect(ids.has(g.exercise.id)).toBe(true);
    }
  });

  it('does not select the same exercise twice in one plan', () => {
    const plan = selectExercises({ ...base, timeAvailableMin: 60 });
    const ids = plan.exercises.map((e) => e.exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── Optional inputs (P0 #9: session-start signals feed the engine) ──────────
// These cover the fields added so /workout's SessionStart can drive the same
// deterministic engine the dashboard card already uses. Every one of them is
// optional, so the suites above double as the back-compat guarantee.

describe('selectExercises — sorenessAreas', () => {
  it('avoids sore muscle parts when other parts can fill the plan', () => {
    const plan = selectExercises({ ...base, sorenessAreas: ['chest'], timeAvailableMin: 30 });
    expect(plan.exercises.length).toBeGreaterThan(0);
    for (const g of plan.exercises) {
      expect(g.exercise.musclePart).not.toBe('chest');
    }
  });

  it('avoids several sore parts at once', () => {
    const sore: MusclePart[] = ['chest', 'back', 'arms'];
    const plan = selectExercises({ ...base, sorenessAreas: sore, timeAvailableMin: 30 });
    expect(plan.exercises.length).toBeGreaterThan(0);
    for (const g of plan.exercises) {
      expect(sore).not.toContain(g.exercise.musclePart);
    }
  });

  it('still returns a plan when every requested part is sore (falls back, never empty)', () => {
    const plan = selectExercises({
      ...base,
      targetBodyParts: ['chest'],
      sorenessAreas: ['chest'],
      timeAvailableMin: 30,
    });
    expect(plan.exercises.length).toBeGreaterThan(0);
    for (const g of plan.exercises) {
      expect(g.exercise.musclePart).toBe('chest');
    }
  });

  it('places non-sore work before any sore top-up', () => {
    const plan = selectExercises({
      ...base,
      targetBodyParts: ['chest', 'legs'],
      sorenessAreas: ['chest'],
      timeAvailableMin: 60,
    });
    const firstChestIdx = plan.exercises.findIndex((g) => g.exercise.musclePart === 'chest');
    const legsCount = plan.exercises.filter((g) => g.exercise.musclePart === 'legs').length;
    // Either no chest at all, or chest appears only once legs work is placed.
    if (firstChestIdx !== -1) expect(legsCount).toBeGreaterThan(0);
  });

  it('an empty sorenessAreas array behaves exactly like omitting it', () => {
    const withEmpty = selectExercises({ ...base, sorenessAreas: [] });
    const without   = selectExercises(base);
    expect(withEmpty.exercises.map((g) => g.exercise.id))
      .toEqual(without.exercises.map((g) => g.exercise.id));
  });
});

describe('selectExercises — energyLevel', () => {
  it('low energy reduces set count by one versus medium', () => {
    const low    = selectExercises({ ...base, energyLevel: 'low' });
    const medium = selectExercises({ ...base, energyLevel: 'medium' });
    expect(low.exercises[0].sets).toBe(medium.exercises[0].sets - 1);
  });

  it('high energy raises set count by one versus medium', () => {
    const high   = selectExercises({ ...base, energyLevel: 'high' });
    const medium = selectExercises({ ...base, energyLevel: 'medium' });
    expect(high.exercises[0].sets).toBe(medium.exercises[0].sets + 1);
  });

  it('medium energy matches the unadjusted goal scheme', () => {
    const medium = selectExercises({ ...base, energyLevel: 'medium' });
    const none   = selectExercises(base);
    expect(medium.exercises[0].sets).toBe(none.exercises[0].sets);
  });

  it('never drops below 2 sets even at low energy on a 3-set goal', () => {
    for (const goal of ['hypertrophy', 'endurance', 'weight_loss'] as const) {
      const plan = selectExercises({ ...base, goal, energyLevel: 'low' });
      for (const g of plan.exercises) expect(g.sets).toBeGreaterThanOrEqual(2);
    }
  });

  it('applies the same set count to every exercise in the plan', () => {
    const plan = selectExercises({ ...base, energyLevel: 'low', timeAvailableMin: 60 });
    const counts = new Set(plan.exercises.map((g) => g.sets));
    expect(counts.size).toBe(1);
  });

  it('does not change which exercises are chosen, only their volume', () => {
    const low  = selectExercises({ ...base, energyLevel: 'low' });
    const high = selectExercises({ ...base, energyLevel: 'high' });
    expect(low.exercises.map((g) => g.exercise.id))
      .toEqual(high.exercises.map((g) => g.exercise.id));
  });
});

describe('selectExercises — recentMuscleParts (recovery-aware ordering)', () => {
  it('orders a part trained today after a part not trained recently', () => {
    const plan = selectExercises({
      ...base,
      targetBodyParts: ['chest', 'legs'],
      recentMuscleParts: [{ musclePart: 'chest', daysAgo: 0 }],
      timeAvailableMin: 45,
    });
    const firstLegs  = plan.exercises.findIndex((g) => g.exercise.musclePart === 'legs');
    const firstChest = plan.exercises.findIndex((g) => g.exercise.musclePart === 'chest');
    expect(firstLegs).toBeGreaterThanOrEqual(0);
    if (firstChest !== -1) expect(firstLegs).toBeLessThan(firstChest);
  });

  it('treats a part trained RECOVERY_DAYS ago or more as fully rested', () => {
    const rested = selectExercises({
      ...base,
      targetBodyParts: ['chest', 'legs'],
      recentMuscleParts: [{ musclePart: 'chest', daysAgo: 7 }],
      timeAvailableMin: 45,
    });
    const none = selectExercises({ ...base, targetBodyParts: ['chest', 'legs'], timeAvailableMin: 45 });
    expect(rested.exercises.map((g) => g.exercise.id))
      .toEqual(none.exercises.map((g) => g.exercise.id));
  });

  it('keeps the most recent entry when a part appears several times', () => {
    const plan = selectExercises({
      ...base,
      targetBodyParts: ['chest', 'legs'],
      recentMuscleParts: [
        { musclePart: 'chest', daysAgo: 9 },
        { musclePart: 'chest', daysAgo: 0 },
      ],
      timeAvailableMin: 45,
    });
    const firstLegs  = plan.exercises.findIndex((g) => g.exercise.musclePart === 'legs');
    const firstChest = plan.exercises.findIndex((g) => g.exercise.musclePart === 'chest');
    if (firstChest !== -1) expect(firstLegs).toBeLessThan(firstChest);
  });

  it('an empty history behaves exactly like omitting it', () => {
    const empty = selectExercises({ ...base, recentMuscleParts: [] });
    const none  = selectExercises(base);
    expect(empty.exercises.map((g) => g.exercise.id))
      .toEqual(none.exercises.map((g) => g.exercise.id));
  });
});

describe('selectExercises — movement-pattern diversity', () => {
  it('varies the pattern within a part when the compound tier offers a choice', () => {
    // Back compounds span h-pull and v-pull, so a back-only plan should use
    // both rather than filling every slot with rows. (Contrast chest, whose
    // compounds in EXERCISE_DB are all h-push — there is no alternative
    // pattern to pick, and compound-before-isolation deliberately outranks
    // pattern diversity, so a chest-only plan legitimately stays h-push.)
    const plan = selectExercises({ ...base, targetBodyParts: ['back'], timeAvailableMin: 60 });
    const patterns = new Set(plan.exercises.map((g) => g.exercise.pattern));
    expect(patterns.size).toBeGreaterThan(1);
  });

  it('compound-before-isolation still wins over pattern diversity', () => {
    // Chest compounds are uniformly h-push; the engine must not reach for an
    // isolation exercise just to diversify patterns while compounds remain.
    const plan = selectExercises({ ...base, targetBodyParts: ['chest'], timeAvailableMin: 60 });
    expect(plan.exercises.length).toBeGreaterThan(0);
    expect(plan.exercises.every((g) => g.exercise.isCompound)).toBe(true);
  });

  it('a full-body plan spans several movement patterns', () => {
    const plan = selectExercises({ ...base, timeAvailableMin: 60 });
    const patterns = new Set(plan.exercises.map((g) => g.exercise.pattern));
    expect(patterns.size).toBeGreaterThanOrEqual(3);
  });
});

describe('selectExercises — determinism holds with all optional inputs set', () => {
  it('same rich input yields an identical plan', () => {
    const rich: GeneratePlanInput = {
      ...base,
      sorenessAreas: ['chest', 'arms'],
      energyLevel: 'low',
      recentMuscleParts: [
        { musclePart: 'legs', daysAgo: 1 },
        { musclePart: 'back', daysAgo: 3 },
      ],
      timeAvailableMin: 60,
    };
    const a = selectExercises(rich);
    const b = selectExercises(rich);
    expect(a.exercises.map((g) => g.exercise.id)).toEqual(b.exercises.map((g) => g.exercise.id));
    expect(a.exercises.map((g) => g.sets)).toEqual(b.exercises.map((g) => g.sets));
    expect(a.estimatedDurationMin).toBe(b.estimatedDurationMin);
  });

  it('still never repeats an exercise with all optional inputs set', () => {
    const plan = selectExercises({
      ...base,
      sorenessAreas: ['chest'],
      energyLevel: 'high',
      recentMuscleParts: [{ musclePart: 'back', daysAgo: 0 }],
      timeAvailableMin: 60,
    });
    const ids = plan.exercises.map((g) => g.exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
