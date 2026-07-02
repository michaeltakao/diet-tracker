import { describe, it, expect } from 'vitest';
import { scaleFood, clampServings, MIN_SERVINGS, MAX_SERVINGS } from '../food-scaling';

const BASE = { calories: 450, protein: 32.5, fat: 12.3, carbs: 55.7 };

describe('clampServings', () => {
  it('passes normal values through', () => {
    expect(clampServings(1.5)).toBe(1.5);
  });

  it('clamps to [MIN, MAX]', () => {
    expect(clampServings(0)).toBe(MIN_SERVINGS);
    expect(clampServings(-2)).toBe(MIN_SERVINGS);
    expect(clampServings(99)).toBe(MAX_SERVINGS);
  });

  it('NaN/Infinity fall back to 1', () => {
    expect(clampServings(NaN)).toBe(1);
    expect(clampServings(Infinity)).toBe(1);
  });
});

describe('scaleFood', () => {
  it('1x returns identical values', () => {
    expect(scaleFood(BASE, 1)).toEqual(BASE);
  });

  it('scales with add-page rounding: whole kcal, 1-decimal macros', () => {
    const half = scaleFood(BASE, 0.5);
    expect(half.calories).toBe(225);        // Math.round(450*0.5)
    expect(half.protein).toBe(16.3);        // round1(16.25) -> 16.3
    expect(half.fat).toBe(6.2);             // round1(6.15) -> 6.2 (banker's-free)
    expect(half.carbs).toBe(27.9);          // round1(27.85)
  });

  it('2x doubles', () => {
    const double = scaleFood(BASE, 2);
    expect(double).toEqual({ calories: 900, protein: 65, fat: 24.6, carbs: 111.4 });
  });

  it('does not mutate the input', () => {
    const copy = { ...BASE };
    scaleFood(BASE, 1.5);
    expect(BASE).toEqual(copy);
  });

  it('scales optional sodium/fiber only when present', () => {
    const withMicros = scaleFood({ ...BASE, sodiumMg: 800, fiberG: 4.4 }, 1.5);
    expect(withMicros.sodiumMg).toBe(1200);
    expect(withMicros.fiberG).toBe(6.6);
    const without = scaleFood(BASE, 1.5) as { sodiumMg?: number };
    expect(without.sodiumMg).toBeUndefined();
  });

  it('preserves extra fields (generic passthrough)', () => {
    const entry = { ...BASE, name: '定食', id: 'x' };
    const scaled = scaleFood(entry, 2);
    expect(scaled.name).toBe('定食');
    expect(scaled.id).toBe('x');
  });

  it('out-of-range servings are clamped, not rejected', () => {
    expect(scaleFood(BASE, 100).calories).toBe(BASE.calories * MAX_SERVINGS);
  });
});
