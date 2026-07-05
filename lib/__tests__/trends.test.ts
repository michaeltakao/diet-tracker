import { describe, it, expect } from 'vitest';
import {
  smoothWeightSeries,
  projectGoalDate,
  computeDailyBalance,
  computeAdherenceSeries,
  computeMacroShortfall,
  lastNDates,
  WEIGHT_SMOOTH_ALPHA,
} from '../trends';

/** Build (date, weight) pairs for consecutive days starting 2026-06-01. */
function weightSeries(weights: number[], startDate = '2026-06-01'): Array<{ date: string; weight: number }> {
  const start = Date.parse(startDate);
  return weights.map((w, i) => ({
    date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    weight: w,
  }));
}

describe('smoothWeightSeries', () => {
  it('returns [] for empty input', () => {
    expect(smoothWeightSeries([])).toEqual([]);
  });

  it('first point passes through unsmoothed', () => {
    const out = smoothWeightSeries(weightSeries([80]));
    expect(out).toEqual([{ date: '2026-06-01', raw: 80, smoothed: 80 }]);
  });

  it('applies EWMA with the default alpha', () => {
    const out = smoothWeightSeries(weightSeries([80, 82]));
    // s1 = α·82 + (1−α)·80
    const expected = WEIGHT_SMOOTH_ALPHA * 82 + (1 - WEIGHT_SMOOTH_ALPHA) * 80;
    expect(out[1].smoothed).toBeCloseTo(expected, 2);
  });

  it('sorts unordered input by date', () => {
    const input = weightSeries([80, 81, 82]).reverse();
    const out = smoothWeightSeries(input);
    expect(out.map(p => p.date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
    expect(out[0].smoothed).toBe(80);
  });

  it('damps single-day spikes (trend stays below raw spike)', () => {
    const out = smoothWeightSeries(weightSeries([80, 80, 83, 80]));
    expect(out[2].smoothed).toBeLessThan(81); // 0.25·83 + 0.75·80 = 80.75
    expect(out[2].smoothed).toBeGreaterThan(80);
  });

  it('dedupes duplicate dates, keeping the last occurrence', () => {
    const out = smoothWeightSeries([
      { date: '2026-06-01', weight: 80 },
      { date: '2026-06-02', weight: 81 },
      { date: '2026-06-02', weight: 79 }, // import/sync duplicate — wins
    ]);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ date: '2026-06-02', raw: 79 });
    // One observation per day: EWMA sees 79, not 81-then-79.
    const expected = WEIGHT_SMOOTH_ALPHA * 79 + (1 - WEIGHT_SMOOTH_ALPHA) * 80;
    expect(out[1].smoothed).toBeCloseTo(expected, 2);
  });
});

describe('projectGoalDate', () => {
  it('returns null with fewer than 3 points', () => {
    expect(projectGoalDate(weightSeries([80, 79.5]), 75)).toBeNull();
  });

  it('computes negative slope for steady loss and projects the goal date', () => {
    // 0.1 kg/day loss for 20 days: 80 → 78.1
    const entries = weightSeries(Array.from({ length: 20 }, (_, i) => 80 - i * 0.1));
    const trend = projectGoalDate(entries, 77);
    expect(trend).not.toBeNull();
    expect(trend!.slope).toBeLessThan(0);
    // EWMA lags the raw series, so slope magnitude is slightly under 0.1
    expect(trend!.slope).toBeGreaterThan(-0.11);
    expect(trend!.projectedGoalDate).not.toBeNull();
    // Goal is ~1.3–1.6 kg below the smoothed last point at ~0.1 kg/day → within ~13–20 days
    expect(trend!.projectedGoalDate! > '2026-06-20').toBe(true);
    expect(trend!.projectedGoalDate! < '2026-07-15').toBe(true);
  });

  it('predictedIn30Days extrapolates the slope', () => {
    const entries = weightSeries(Array.from({ length: 20 }, (_, i) => 80 - i * 0.1));
    const trend = projectGoalDate(entries, null);
    // last smoothed ≈ 78.4, +30 days of ≈ −0.1 kg/day → ≈ 75.5 ± 1
    expect(trend!.predictedIn30Days).toBeLessThan(77.5);
    expect(trend!.predictedIn30Days).toBeGreaterThan(74);
  });

  it('flat series → slope 0 and no goal date', () => {
    const trend = projectGoalDate(weightSeries([80, 80, 80, 80, 80]), 75);
    expect(trend).not.toBeNull();
    expect(trend!.slope).toBe(0);
    expect(trend!.projectedGoalDate).toBeNull();
  });

  it('no goal → projectedGoalDate null but slope still reported', () => {
    const entries = weightSeries(Array.from({ length: 10 }, (_, i) => 80 - i * 0.1));
    const trend = projectGoalDate(entries, null);
    expect(trend!.projectedGoalDate).toBeNull();
    expect(trend!.slope).toBeLessThan(0);
  });

  it('trend moving away from the goal → no goal date', () => {
    // gaining while goal is below current weight
    const entries = weightSeries(Array.from({ length: 10 }, (_, i) => 80 + i * 0.1));
    const trend = projectGoalDate(entries, 75);
    expect(trend!.projectedGoalDate).toBeNull();
    expect(trend!.slope).toBeGreaterThan(0);
  });

  it('ETA beyond MAX_PROJECTION_DAYS → null', () => {
    // −0.01 kg/day, goal 10 kg away → ~1000 days
    const entries = weightSeries(Array.from({ length: 20 }, (_, i) => 80 - i * 0.01));
    const trend = projectGoalDate(entries, 70);
    expect(trend!.projectedGoalDate).toBeNull();
  });

  it('only uses the trailing window', () => {
    // 40 days: first 20 flat at 85, last 20 losing 0.2/day → window=30 mixes,
    // window=10 sees only the loss
    const flat = weightSeries(Array.from({ length: 20 }, () => 85), '2026-05-01');
    const losing = weightSeries(Array.from({ length: 20 }, (_, i) => 85 - i * 0.2), '2026-05-21');
    const trendNarrow = projectGoalDate([...flat, ...losing], null, 10);
    const trendWide = projectGoalDate([...flat, ...losing], null, 40);
    expect(trendNarrow!.slope).toBeLessThan(trendWide!.slope); // steeper (more negative)
  });
});

describe('computeDailyBalance', () => {
  const dates = ['2026-06-01', '2026-06-02', '2026-06-03'];

  it('joins intake and carried-forward TDEE', () => {
    const out = computeDailyBalance(
      dates,
      [{ date: '2026-06-01', totalKcal: 2100 }, { date: '2026-06-03', totalKcal: 1900 }],
      [{ date: '2026-06-01', tdeeKcal: 2000 }],
    );
    expect(out).toEqual([
      { date: '2026-06-01', intakeKcal: 2100, expenditureKcal: 2000, balanceKcal: 100 },
      { date: '2026-06-02', intakeKcal: null, expenditureKcal: 2000, balanceKcal: null },
      { date: '2026-06-03', intakeKcal: 1900, expenditureKcal: 2000, balanceKcal: -100 },
    ]);
  });

  it('uses the most recent estimate at or before each date', () => {
    const out = computeDailyBalance(
      dates,
      [{ date: '2026-06-03', totalKcal: 2000 }],
      [
        { date: '2026-06-03', tdeeKcal: 2200 },
        { date: '2026-06-01', tdeeKcal: 2000 }, // unordered on purpose
      ],
    );
    expect(out[1].expenditureKcal).toBe(2000);
    expect(out[2].expenditureKcal).toBe(2200);
    expect(out[2].balanceKcal).toBe(-200);
  });

  it('no TDEE history → expenditure and balance null', () => {
    const out = computeDailyBalance(dates, [{ date: '2026-06-01', totalKcal: 1800 }], []);
    expect(out[0]).toEqual({
      date: '2026-06-01', intakeKcal: 1800, expenditureKcal: null, balanceKcal: null,
    });
  });

  it('TDEE estimate dated after the axis start is not applied retroactively', () => {
    const out = computeDailyBalance(dates, [], [{ date: '2026-06-02', tdeeKcal: 2000 }]);
    expect(out[0].expenditureKcal).toBeNull();
    expect(out[1].expenditureKcal).toBe(2000);
  });
});

describe('computeAdherenceSeries', () => {
  const dates = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04'];

  it('classifies within/over/under with ±200 kcal and skips missing days', () => {
    const out = computeAdherenceSeries(
      dates,
      [
        { date: '2026-06-01', totalKcal: 2000 }, // within (== goal)
        { date: '2026-06-02', totalKcal: 2201 }, // over  (> +200)
        { date: '2026-06-03', totalKcal: 1799 }, // under (< −200)
      ],
      2000,
    );
    expect(out.perDay.map(d => d.status)).toEqual(['within', 'over', 'under', 'noData']);
    expect(out.loggedDays).toBe(3);
    expect(out.adherencePct).toBe(33); // 1/3 logged days within
  });

  it('boundary values ±200 are within (inclusive), matching weekly report', () => {
    const out = computeAdherenceSeries(
      ['2026-06-01', '2026-06-02'],
      [
        { date: '2026-06-01', totalKcal: 2200 },
        { date: '2026-06-02', totalKcal: 1800 },
      ],
      2000,
    );
    expect(out.perDay.map(d => d.status)).toEqual(['within', 'within']);
    expect(out.adherencePct).toBe(100);
  });

  it('no logged days → adherencePct null', () => {
    const out = computeAdherenceSeries(dates, [], 2000);
    expect(out.adherencePct).toBeNull();
    expect(out.loggedDays).toBe(0);
  });
});

describe('computeMacroShortfall', () => {
  const dates = ['2026-06-01', '2026-06-02'];
  const goals = { protein: 150, fat: 60, carbs: 200 };

  it('sums entries per day, averages over logged days, reports shortfalls', () => {
    const out = computeMacroShortfall(
      dates,
      [
        { date: '2026-06-01', protein: 60, fat: 30, carbs: 120 },
        { date: '2026-06-01', protein: 40, fat: 20, carbs: 80 },  // same day: sums to 100/50/200
        { date: '2026-06-02', protein: 120, fat: 70, carbs: 180 },
      ],
      goals,
    );
    expect(out.loggedDays).toBe(2);
    expect(out.avgProtein).toBe(110);   // (100+120)/2
    expect(out.avgFat).toBe(60);        // (50+70)/2
    expect(out.avgCarbs).toBe(190);     // (200+180)/2
    expect(out.proteinShortfallG).toBe(40);
    expect(out.fatShortfallG).toBe(0);  // met exactly
    expect(out.carbsShortfallG).toBe(10);
  });

  it('exceeding a goal reports 0 shortfall, never negative', () => {
    const out = computeMacroShortfall(
      ['2026-06-01'],
      [{ date: '2026-06-01', protein: 200, fat: 80, carbs: 300 }],
      goals,
    );
    expect(out.proteinShortfallG).toBe(0);
    expect(out.fatShortfallG).toBe(0);
    expect(out.carbsShortfallG).toBe(0);
  });

  it('entries outside the axis are ignored; empty axis days → nulls', () => {
    const out = computeMacroShortfall(
      dates,
      [{ date: '2026-05-31', protein: 100, fat: 50, carbs: 150 }],
      goals,
    );
    expect(out.loggedDays).toBe(0);
    expect(out.avgProtein).toBeNull();
    expect(out.proteinShortfallG).toBe(0);
  });
});

describe('lastNDates', () => {
  it('builds an inclusive date-ascending axis ending at endDate', () => {
    expect(lastNDates('2026-06-03', 3)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
  });

  it('crosses month boundaries correctly (UTC arithmetic)', () => {
    expect(lastNDates('2026-07-01', 2)).toEqual(['2026-06-30', '2026-07-01']);
  });
});
