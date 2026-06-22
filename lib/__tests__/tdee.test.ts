/**
 * Unit tests for lib/tdee.ts — pure TDEE estimation logic.
 *
 * All tests are deterministic and require no network/DB access.
 *
 * Tested scenarios:
 *   - Nominal regression with clear weight trend
 *   - Insufficient data (< MIN_DATA_POINTS) → null or Mifflin fallback
 *   - Weight plateau (degenerate regression) → fallback
 *   - Exponential smoothing with previous estimate
 *   - Physiological bound clamping (< 800, > 6000)
 *   - tdeeConfidenceLabel thresholds
 */

import { describe, it, expect } from 'vitest';
import { estimateTdee, tdeeConfidenceLabel, MIN_DATA_POINTS } from '../tdee';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDate(daysBack: number): string {
  const d = new Date('2026-06-22');
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

/** Generate N paired days: constant intake, linear weight trend. */
function syntheticData(
  n: number,
  dailyCalories: number,
  startWeight: number,
  slopeKgPerDay: number,
): {
  weightLogs:  Array<{ date: string; weightKg: number }>;
  calorieLogs: Array<{ date: string; totalKcal: number }>;
} {
  const weightLogs  = [];
  const calorieLogs = [];
  for (let i = 0; i < n; i++) {
    const date = makeDate(n - 1 - i);
    weightLogs.push({ date, weightKg: startWeight + slopeKgPerDay * i });
    calorieLogs.push({ date, totalKcal: dailyCalories });
  }
  return { weightLogs, calorieLogs };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('estimateTdee', () => {

  it('returns null when no weight logs provided', () => {
    const result = estimateTdee({
      weightLogs:  [],
      calorieLogs: [],
      prevTdee:    null,
    });
    expect(result.tdeeKcal).toBeNull();
    expect(result.dataPoints).toBe(0);
  });

  it('returns null (no fallback params) when data points < MIN_DATA_POINTS', () => {
    const { weightLogs, calorieLogs } = syntheticData(
      MIN_DATA_POINTS - 1, 2000, 70, 0,
    );
    const result = estimateTdee({ weightLogs, calorieLogs, prevTdee: null });
    // No Mifflin params → tdeeKcal is null
    expect(result.tdeeKcal).toBeNull();
    expect(result.dataPoints).toBe(MIN_DATA_POINTS - 1);
  });

  it('uses Mifflin-St Jeor fallback when data < MIN_DATA_POINTS and params provided', () => {
    const { weightLogs, calorieLogs } = syntheticData(3, 2000, 70, 0);
    const result = estimateTdee({
      weightLogs, calorieLogs, prevTdee: null,
      weightKg: 70, heightCm: 175, age: 25, sex: 'male',
    });
    expect(result.tdeeKcal).not.toBeNull();
    expect(result.isFallback).toBe(true);
    // Mifflin BMR for 70kg/175cm/25yr male = 10×70 + 6.25×175 - 5×25 + 5
    //   = 700 + 1093.75 - 125 + 5 = 1673.75 → ×1.55 ≈ 2594.3
    expect(result.tdeeKcal!).toBeCloseTo(2594.3, 0);
  });

  it('estimates TDEE correctly for a user in caloric deficit (losing weight)', () => {
    // 2000 kcal/day intake, losing 0.1 kg/day → TDEE ≈ 2000 + 0.1×7700 = 2770
    const { weightLogs, calorieLogs } = syntheticData(14, 2000, 75, -0.1);
    const result = estimateTdee({ weightLogs, calorieLogs, prevTdee: null });
    expect(result.tdeeKcal).not.toBeNull();
    expect(result.isFallback).toBe(false);
    expect(result.tdeeKcal!).toBeCloseTo(2770, -1); // within ±10 kcal
  });

  it('estimates TDEE correctly for a user in caloric surplus (gaining weight)', () => {
    // 3000 kcal/day intake, gaining 0.05 kg/day → TDEE ≈ 3000 - 0.05×7700 = 2615
    const { weightLogs, calorieLogs } = syntheticData(14, 3000, 70, 0.05);
    const result = estimateTdee({ weightLogs, calorieLogs, prevTdee: null });
    expect(result.tdeeKcal).not.toBeNull();
    expect(result.tdeeKcal!).toBeCloseTo(2615, -1);
  });

  it('estimates TDEE for stable weight (maintenance) as ~= avg calories', () => {
    // 0 slope → TDEE ≈ intake, but OLS slope ≈ 0 triggers plateau fallback
    // With exactly 0 slope, rSquared = 0 → degenerate branch → isFallback = true
    // or returns rawTdee = avgCalories. Either way, value should be ~2200.
    const { weightLogs, calorieLogs } = syntheticData(14, 2200, 72, 0);
    const result = estimateTdee({ weightLogs, calorieLogs, prevTdee: null });
    expect(result.tdeeKcal).not.toBeNull();
    // Either raw ~2200 or Mifflin (no params provided → null fallback used)
    // The degenerate branch computes rawTdee = avgCalories = 2200 and returns it
    expect(result.tdeeKcal!).toBeCloseTo(2200, -1);
  });

  it('applies exponential smoothing with previous estimate', () => {
    // Raw TDEE ≈ 2770; prevTdee = 2000; smoothed = 0.3*2770 + 0.7*2000 = 2231
    const { weightLogs, calorieLogs } = syntheticData(14, 2000, 75, -0.1);
    const result = estimateTdee({ weightLogs, calorieLogs, prevTdee: 2000 });
    expect(result.tdeeKcal).not.toBeNull();
    expect(result.tdeeKcal!).toBeCloseTo(2231, -1);
  });

  it('clamps outrageously low raw estimates to 800 kcal', () => {
    // Extreme weight gain scenario: intake 500, gaining fast → raw TDEE could go negative
    const { weightLogs, calorieLogs } = syntheticData(14, 500, 70, 1.0);
    const result = estimateTdee({ weightLogs, calorieLogs, prevTdee: null });
    if (result.tdeeKcal !== null) {
      expect(result.tdeeKcal).toBeGreaterThanOrEqual(800);
    }
  });

  it('clamps outrageously high raw estimates to 6000 kcal', () => {
    // Extreme deficit: intake 8000, massive weight loss → raw TDEE very high
    const { weightLogs, calorieLogs } = syntheticData(14, 8000, 100, -1.0);
    const result = estimateTdee({ weightLogs, calorieLogs, prevTdee: null });
    if (result.tdeeKcal !== null) {
      expect(result.tdeeKcal).toBeLessThanOrEqual(6000);
    }
  });

  it('reports R² close to 1 for perfectly linear weight data', () => {
    const { weightLogs, calorieLogs } = syntheticData(14, 2000, 75, -0.1);
    const result = estimateTdee({ weightLogs, calorieLogs, prevTdee: null });
    expect(result.rSquared).not.toBeNull();
    expect(result.rSquared!).toBeCloseTo(1.0, 2);
  });

  it('ignores calorie logs outside the weight-log date range', () => {
    const { weightLogs, calorieLogs } = syntheticData(14, 2000, 75, -0.1);
    // Add a stale calorie log from 60 days ago — should not affect the estimate
    const staleDate = makeDate(60);
    calorieLogs.push({ date: staleDate, totalKcal: 10000 });
    const result = estimateTdee({ weightLogs, calorieLogs, prevTdee: null });
    expect(result.tdeeKcal!).toBeCloseTo(2770, -1);
  });

  it('counts only days with BOTH a weight log AND a calorie log as data points', () => {
    const { weightLogs, calorieLogs } = syntheticData(14, 2000, 75, -0.1);
    // Remove calorie log for the last 3 days → 11 paired days
    const trimmed = calorieLogs.slice(0, 11);
    const result = estimateTdee({ weightLogs, calorieLogs: trimmed, prevTdee: null });
    expect(result.dataPoints).toBe(11);
  });

});

describe('tdeeConfidenceLabel', () => {
  it('returns "高" for R² ≥ 0.70', () => {
    expect(tdeeConfidenceLabel(0.70)).toBe('高');
    expect(tdeeConfidenceLabel(0.95)).toBe('高');
    expect(tdeeConfidenceLabel(1.00)).toBe('高');
  });

  it('returns "中" for 0.40 ≤ R² < 0.70', () => {
    expect(tdeeConfidenceLabel(0.40)).toBe('中');
    expect(tdeeConfidenceLabel(0.55)).toBe('中');
    expect(tdeeConfidenceLabel(0.699)).toBe('中');
  });

  it('returns "低" for R² < 0.40', () => {
    expect(tdeeConfidenceLabel(0.00)).toBe('低');
    expect(tdeeConfidenceLabel(0.39)).toBe('低');
  });

  it('returns "—" for null', () => {
    expect(tdeeConfidenceLabel(null)).toBe('—');
  });
});
