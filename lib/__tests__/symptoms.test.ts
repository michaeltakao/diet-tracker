import { describe, it, expect } from 'vitest';
import {
  isValidSeverity,
  isValidDuration,
  isValidSymptomInput,
  SEVERITY_MIN,
  SEVERITY_MAX,
  DURATION_MAX_MINUTES,
} from '../symptoms';

describe('isValidSeverity', () => {
  it('accepts integers 1–10', () => {
    expect(isValidSeverity(SEVERITY_MIN)).toBe(true);
    expect(isValidSeverity(5)).toBe(true);
    expect(isValidSeverity(SEVERITY_MAX)).toBe(true);
  });

  it('rejects out-of-bounds and non-integer values', () => {
    expect(isValidSeverity(0)).toBe(false);
    expect(isValidSeverity(11)).toBe(false);
    expect(isValidSeverity(5.5)).toBe(false);
    expect(isValidSeverity(NaN)).toBe(false);
  });
});

describe('isValidDuration', () => {
  it('accepts undefined (duration is optional)', () => {
    expect(isValidDuration(undefined)).toBe(true);
  });

  it('accepts 1 to one week of minutes', () => {
    expect(isValidDuration(1)).toBe(true);
    expect(isValidDuration(30)).toBe(true);
    expect(isValidDuration(DURATION_MAX_MINUTES)).toBe(true);
  });

  it('rejects zero, negative, over-a-week, and fractional values', () => {
    expect(isValidDuration(0)).toBe(false);
    expect(isValidDuration(-10)).toBe(false);
    expect(isValidDuration(DURATION_MAX_MINUTES + 1)).toBe(false);
    expect(isValidDuration(1.5)).toBe(false);
  });
});

describe('isValidSymptomInput', () => {
  it('requires a non-blank name plus valid bounds', () => {
    expect(isValidSymptomInput({ name: '頭痛', severity: 5 })).toBe(true);
    expect(isValidSymptomInput({ name: '頭痛', severity: 5, durationMin: 30 })).toBe(true);
    expect(isValidSymptomInput({ name: '   ', severity: 5 })).toBe(false);
    expect(isValidSymptomInput({ name: '頭痛', severity: 0 })).toBe(false);
    expect(isValidSymptomInput({ name: '頭痛', severity: 5, durationMin: 0 })).toBe(false);
  });
});
