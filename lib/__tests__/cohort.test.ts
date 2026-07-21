import { describe, it, expect } from 'vitest';
import { assignCohort, type CohortRng } from '../cohort';

function fixedRng(values: number[]): CohortRng {
  let i = 0;
  return { next: () => values[i++ % values.length] };
}

describe('assignCohort', () => {
  it('assigns control when next() < 0.5', () => {
    expect(assignCohort(fixedRng([0]))).toBe('control');
    expect(assignCohort(fixedRng([0.1]))).toBe('control');
    expect(assignCohort(fixedRng([0.4999]))).toBe('control');
  });

  it('assigns xai_treatment when next() >= 0.5', () => {
    expect(assignCohort(fixedRng([0.5]))).toBe('xai_treatment');
    expect(assignCohort(fixedRng([0.9]))).toBe('xai_treatment');
    expect(assignCohort(fixedRng([0.9999]))).toBe('xai_treatment');
  });

  it('covers both branches across a fixed sequence', () => {
    const rng = fixedRng([0.1, 0.6, 0.2, 0.8]);
    const results = [assignCohort(rng), assignCohort(rng), assignCohort(rng), assignCohort(rng)];
    expect(results).toEqual(['control', 'xai_treatment', 'control', 'xai_treatment']);
  });
});
