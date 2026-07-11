import { describe, it, expect } from 'vitest';
import {
  ageBand,
  isMinor,
  isSenior,
  estimatedEnergyRequirement,
  proteinRda,
  recommendedGoals,
  SENIOR_PROTEIN_G_PER_KG,
  type AgeBand,
} from '@/lib/nutrition-standards';
import type { ActivityLevel } from '@/lib/types';

// ── ageBand ─────────────────────────────────────────────────────────────────

describe('ageBand', () => {
  it('returns null below 12 and for unset/non-finite ages', () => {
    expect(ageBand(11)).toBeNull();
    expect(ageBand(0)).toBeNull();
    expect(ageBand(null)).toBeNull();
    expect(ageBand(undefined)).toBeNull();
    expect(ageBand(NaN)).toBeNull();
  });

  it('maps band edges exactly', () => {
    expect(ageBand(12)).toBe('12-14');
    expect(ageBand(14)).toBe('12-14');
    expect(ageBand(15)).toBe('15-17');
    expect(ageBand(17)).toBe('15-17');
    expect(ageBand(18)).toBe('18-29');
    expect(ageBand(29)).toBe('18-29');
    expect(ageBand(30)).toBe('30-49');
    expect(ageBand(49)).toBe('30-49');
    expect(ageBand(50)).toBe('50-64');
    expect(ageBand(64)).toBe('50-64');
    expect(ageBand(65)).toBe('65-74');
    expect(ageBand(74)).toBe('65-74');
    expect(ageBand(75)).toBe('75+');
    expect(ageBand(100)).toBe('75+');
  });
});

describe('isMinor / isSenior', () => {
  it('isMinor covers exactly 12–17', () => {
    expect(isMinor(11)).toBe(false);
    expect(isMinor(12)).toBe(true);
    expect(isMinor(17)).toBe(true);
    expect(isMinor(18)).toBe(false);
    expect(isMinor(null)).toBe(false);
  });

  it('isSenior covers exactly 65+', () => {
    expect(isSenior(64)).toBe(false);
    expect(isSenior(65)).toBe(true);
    expect(isSenior(75)).toBe(true);
    expect(isSenior(null)).toBe(false);
  });
});

// ── estimatedEnergyRequirement ──────────────────────────────────────────────

describe('estimatedEnergyRequirement', () => {
  it('returns null out of scope', () => {
    expect(estimatedEnergyRequirement(11, 'male', 'moderately_active')).toBeNull();
    expect(estimatedEnergyRequirement(null, 'male', 'moderately_active')).toBeNull();
  });

  it('looks up table values (spot-check 18-29 ふつう)', () => {
    expect(estimatedEnergyRequirement(25, 'male',   'moderately_active')).toBe(2600);
    expect(estimatedEnergyRequirement(25, 'female', 'moderately_active')).toBe(1950);
  });

  it('averages male/female when sex is unset', () => {
    // (2600 + 1950) / 2 = 2275
    expect(estimatedEnergyRequirement(25, null, 'moderately_active')).toBe(2275);
  });

  it('is monotonically non-decreasing in activity level for every band and sex', () => {
    const bandAges: Record<AgeBand, number> = {
      '12-14': 13, '15-17': 16, '18-29': 25, '30-49': 40,
      '50-64': 55, '65-74': 70, '75+': 80,
    };
    const levels: ActivityLevel[] = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'];
    for (const age of Object.values(bandAges)) {
      for (const sex of ['male', 'female', null] as const) {
        const values = levels.map(lv => estimatedEnergyRequirement(age, sex, lv)!);
        for (let i = 1; i < values.length; i++) {
          expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
        }
      }
    }
  });

  it('maps the 5-way ActivityLevel onto 3 PAL columns', () => {
    // lightly_active and moderately_active share ふつう; very/extra share 高い
    expect(estimatedEnergyRequirement(25, 'male', 'lightly_active'))
      .toBe(estimatedEnergyRequirement(25, 'male', 'moderately_active'));
    expect(estimatedEnergyRequirement(25, 'male', 'extra_active'))
      .toBe(estimatedEnergyRequirement(25, 'male', 'very_active'));
  });

  it('falls back to ふつう for 高い in the 75+ band (no 高い column in the 基準)', () => {
    expect(estimatedEnergyRequirement(80, 'male', 'very_active'))
      .toBe(estimatedEnergyRequirement(80, 'male', 'moderately_active'));
  });
});

// ── proteinRda ──────────────────────────────────────────────────────────────

describe('proteinRda', () => {
  it('returns table values and averages when sex is unset', () => {
    expect(proteinRda(25, 'male')).toBe(65);
    expect(proteinRda(25, 'female')).toBe(50);
    expect(proteinRda(25, null)).toBe(58); // round(57.5)
  });

  it('returns null out of scope', () => {
    expect(proteinRda(11, 'male')).toBeNull();
    expect(proteinRda(null, null)).toBeNull();
  });
});

// ── recommendedGoals ────────────────────────────────────────────────────────

describe('recommendedGoals', () => {
  const base = { age: 25, sex: 'male' as const, activityLevel: 'moderately_active' as const };

  it('returns null when age is out of scope', () => {
    expect(recommendedGoals({ ...base, age: 11 }, 60)).toBeNull();
    expect(recommendedGoals({ ...base, age: null }, 60)).toBeNull();
  });

  it('computes fat and carbs from %E midpoints (25 %E / 57.5 %E)', () => {
    const goals = recommendedGoals(base, 60)!; // energy 2600
    expect(goals.calories).toBe(2600);
    expect(goals.fat).toBe(Math.round((2600 * 25 / 100) / 9));    // 72
    expect(goals.carbs).toBe(Math.round((2600 * 57.5 / 100) / 4)); // 374
  });

  it('keeps water at 2000 ml (no 基準 RDA for water)', () => {
    expect(recommendedGoals(base, 60)!.water).toBe(2000);
  });

  it('applies the senior protein floor when the weight makes it bind', () => {
    const senior = { age: 70, sex: 'male' as const, activityLevel: 'moderately_active' as const };
    // RDA(male 65-74) = 60 g. At 80 kg the 1.0 g/kg floor (80 g) wins…
    expect(recommendedGoals(senior, 80)!.protein).toBe(Math.round(SENIOR_PROTEIN_G_PER_KG * 80));
    // …at 50 kg the RDA (60 g) wins…
    expect(recommendedGoals(senior, 50)!.protein).toBe(60);
    // …and with no weight the floor cannot apply.
    expect(recommendedGoals(senior, null)!.protein).toBe(60);
  });

  it('does not apply the senior floor to non-seniors', () => {
    expect(recommendedGoals(base, 200)!.protein).toBe(65); // RDA, not 200
  });

  it('never returns a caloric deficit for minors (energy equals the band EER)', () => {
    for (const age of [12, 14, 15, 17]) {
      for (const sex of ['male', 'female', null] as const) {
        const goals = recommendedGoals({ age, sex, activityLevel: 'moderately_active' }, 50)!;
        expect(goals.calories).toBe(
          estimatedEnergyRequirement(age, sex, 'moderately_active'),
        );
        // Sanity: growth-phase EERs are all well above adult weight-loss targets.
        expect(goals.calories).toBeGreaterThanOrEqual(2300 - 250); // ≥ female 12-14 ふつう lower bound
      }
    }
  });
});
