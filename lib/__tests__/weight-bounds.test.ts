import { describe, it, expect } from 'vitest';
import { isValidWeightKg } from '../weight-bounds';

describe('isValidWeightKg (home + /weight share it)', () => {
  it.each([[19.9, false], [20, true], [65.4, true], [300, true], [300.1, false], [0, false], [NaN, false], [Infinity, false]])(
    '%s → %s', (v, want) => expect(isValidWeightKg(v)).toBe(want));
});
