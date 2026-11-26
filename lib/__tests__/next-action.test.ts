import { describe, it, expect } from 'vitest';
import { nextAction, dueSlots, type NextActionInput } from '../next-action';

const base: NextActionInput = { hasGoals: true, filledSlots: [], weightLoggedToday: false, nowJst: '08:00' };
const at = (nowJst: string, over: Partial<NextActionInput> = {}) => nextAction({ ...base, nowJst, ...over });

describe('dueSlots (JST boundaries)', () => {
  it.each([
    ['00:00', ['breakfast']],
    ['10:59', ['breakfast']],
    ['11:00', ['lunch', 'breakfast']],
    ['15:59', ['lunch', 'breakfast']],
    ['16:00', ['dinner', 'lunch', 'breakfast']],
    ['23:59', ['dinner', 'lunch', 'breakfast']],
  ])('%s → %j', (now, want) => {
    expect(dueSlots(now)).toEqual(want);
  });
});

describe('nextAction rule table', () => {
  it('goals missing wins over everything', () => {
    expect(at('20:00', { hasGoals: false, filledSlots: ['breakfast', 'lunch', 'dinner'], weightLoggedToday: true }))
      .toEqual({ kind: 'set-goals' });
  });

  it('10:59 with nothing logged → breakfast', () => {
    expect(at('10:59')).toEqual({ kind: 'log-meal', slot: 'breakfast' });
  });

  it('11:00 with nothing logged → lunch (current slot first)', () => {
    expect(at('11:00')).toEqual({ kind: 'log-meal', slot: 'lunch' });
  });

  it('11:00 with lunch logged but breakfast missing → breakfast', () => {
    expect(at('11:00', { filledSlots: ['lunch'] })).toEqual({ kind: 'log-meal', slot: 'breakfast' });
  });

  it('15:59 vs 16:00 boundary for dinner', () => {
    expect(at('15:59', { filledSlots: ['breakfast', 'lunch'] })).toEqual({ kind: 'log-weight' });
    expect(at('16:00', { filledSlots: ['breakfast', 'lunch'] })).toEqual({ kind: 'log-meal', slot: 'dinner' });
  });

  it('morning: breakfast logged, no weight → weight', () => {
    expect(at('08:00', { filledSlots: ['breakfast'] })).toEqual({ kind: 'log-weight' });
  });

  it('snack is never required', () => {
    expect(at('21:00', { filledSlots: ['breakfast', 'lunch', 'dinner'], weightLoggedToday: true }))
      .toEqual({ kind: 'done' });
  });

  it('meal outranks weight', () => {
    expect(at('19:00', { filledSlots: ['breakfast', 'lunch'] })).toEqual({ kind: 'log-meal', slot: 'dinner' });
  });
});
