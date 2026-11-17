/**
 * kcal-only meals (029, ADR-011) hold 0 g placeholders for P/F/C. They must
 * count toward calories but never toward macro sums.
 */
import { describe, it, expect } from 'vitest';
import { partialMacroFields, sumIntake } from '../macros';
import type { FoodEntry } from '../types';

const meal = (over: Partial<FoodEntry>): FoodEntry => ({
  id: 'x', date: '2026-11-17', mealType: 'lunch', name: 'n',
  calories: 0, protein: 0, fat: 0, carbs: 0, addedAt: '2026-11-17T03:00:00Z',
  ...over,
});

describe('sumIntake', () => {
  it('excludes kcal-only placeholders from P/F/C and counts them', () => {
    const t = sumIntake([
      meal({ calories: 600, protein: 30, fat: 20, carbs: 70, macrosEntered: true }),
      meal({ calories: 900, macrosEntered: false }),
    ]);
    expect(t).toEqual({ calories: 1500, protein: 30, fat: 20, carbs: 70, enteredCount: 1, kcalOnlyCount: 1 });
  });

  it('treats entries without the flag (pre-029) as entered', () => {
    const t = sumIntake([meal({ calories: 500, protein: 25, fat: 10, carbs: 60 })]);
    expect(t.enteredCount).toBe(1);
    expect(t.protein).toBe(25);
  });

  it('all kcal-only → no entered macros', () => {
    const t = sumIntake([meal({ calories: 650, macrosEntered: false })]);
    expect(t.enteredCount).toBe(0);
    expect(t.calories).toBe(650);
  });
});

describe('partialMacroFields', () => {
  it('none or all given is valid', () => {
    expect(partialMacroFields({ protein: false, fat: false, carbs: false })).toBeNull();
    expect(partialMacroFields({ protein: true, fat: true, carbs: true })).toBeNull();
  });
  it('a partial input names the missing fields', () => {
    expect(partialMacroFields({ protein: true, fat: false, carbs: false })).toEqual(['fat', 'carbs']);
  });
});
