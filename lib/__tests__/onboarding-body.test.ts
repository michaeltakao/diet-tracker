/**
 * Onboarding body step (ADR-008 P0-5, bug B6): untouched steppers are display
 * defaults and must never be stored as the participant's data.
 */
import { describe, it, expect } from 'vitest';
import { resolveBody, type BodyField, type BodyValues } from '../onboarding-body';

const YEAR = 2026;
const DEFAULTS: BodyValues = { birthYear: YEAR - 25, sex: 'unset', heightCm: 165, weightKg: 60 };
const set = (...f: BodyField[]) => new Set<BodyField>(f);

describe('resolveBody', () => {
  it('B6: 次へ without touching anything stores nothing and logs no weight', () => {
    const r = resolveBody(DEFAULTS, set(), set(), false, YEAR);
    expect(r.weightToLog).toBeNull();
    expect(r.profile).toEqual({});
    expect(r.answers).toEqual({ birthYear: null, sex: null, heightCm: null, weightKg: null });
    expect(r.complete).toBe(false);
  });

  it('logs exactly the weight the user set', () => {
    const r = resolveBody({ ...DEFAULTS, weightKg: 72 }, set('weightKg'), set(), false, YEAR);
    expect(r.weightToLog).toBe(72);
    expect(r.answers.weightKg).toBe(72);
    expect(r.answers.heightCm).toBeNull(); // still the 165 display default
    expect(r.complete).toBe(false);
  });

  it('all three numbers touched → complete; profile gets age/height', () => {
    const v: BodyValues = { birthYear: 1998, sex: 'female', heightCm: 158, weightKg: 52 };
    const r = resolveBody(v, set('birthYear', 'sex', 'heightCm', 'weightKg'), set(), false, YEAR);
    expect(r.complete).toBe(true);
    expect(r.profile).toEqual({ age: 28, sex: 'female', heightCm: 158 });
    expect(r.weightToLog).toBe(52);
    expect(r.answers).toEqual({ birthYear: 1998, sex: 'female', heightCm: 158, weightKg: 52 });
  });

  it('pre-filled values count as real answers but are not re-logged as today’s weight', () => {
    const v: BodyValues = { birthYear: 1990, sex: 'male', heightCm: 175, weightKg: 70 };
    const r = resolveBody(v, set(), set('birthYear', 'sex', 'heightCm', 'weightKg'), false, YEAR);
    expect(r.complete).toBe(true);
    expect(r.weightToLog).toBeNull(); // the rounded latest entry is not a new measurement
    expect(r.profile).toEqual({});    // nothing changed → nothing rewritten
    expect(r.answers.weightKg).toBe(70);
  });

  it('choosing 回答しない is an answer (sex null written), not a default', () => {
    const r = resolveBody(DEFAULTS, set('sex'), set(), false, YEAR);
    expect(r.profile).toEqual({ sex: null });
    expect(r.answers.sex).toBeNull();
  });

  it('skipping the step stores nothing even if steppers were touched first', () => {
    const r = resolveBody({ ...DEFAULTS, weightKg: 80 }, set('weightKg', 'heightCm'), set('birthYear'), true, YEAR);
    expect(r.weightToLog).toBeNull();
    expect(r.profile).toEqual({});
    expect(r.answers).toEqual({ birthYear: null, sex: null, heightCm: null, weightKg: null });
    expect(r.complete).toBe(false);
  });
});
