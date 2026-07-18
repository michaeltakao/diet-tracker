import { describe, it, expect } from 'vitest';
import { isValidBarcode, normalizeOffProduct } from '@/lib/off';

/** Minimal OFF v2 response builder. */
function offResponse(overrides: {
  name?: unknown;
  nutriments?: Record<string, unknown>;
  brands?: unknown;
  serving_quantity?: unknown;
  serving_quantity_unit?: unknown;
  status?: unknown;
}) {
  return {
    status: overrides.status ?? 1,
    product: {
      product_name: overrides.name ?? 'テスト食品',
      brands: overrides.brands,
      nutriments: overrides.nutriments ?? { 'energy-kcal_100g': 250 },
      serving_quantity: overrides.serving_quantity,
      serving_quantity_unit: overrides.serving_quantity_unit,
    },
  };
}

describe('isValidBarcode', () => {
  it('accepts EAN-8 through GTIN-14', () => {
    expect(isValidBarcode('12345678')).toBe(true);       // EAN-8
    expect(isValidBarcode('4901777018888')).toBe(true);  // EAN-13 (JP)
    expect(isValidBarcode('12345678901234')).toBe(true); // GTIN-14
  });

  it('rejects wrong lengths and non-digits', () => {
    expect(isValidBarcode('1234567')).toBe(false);          // too short
    expect(isValidBarcode('123456789012345')).toBe(false);  // too long
    expect(isValidBarcode('49017770abcde')).toBe(false);
    expect(isValidBarcode('')).toBe(false);
    expect(isValidBarcode('4901777-01888')).toBe(false);
  });
});

describe('normalizeOffProduct', () => {
  it('normalizes a full product with direct sodium (g → mg)', () => {
    const p = normalizeOffProduct(offResponse({
      nutriments: {
        'energy-kcal_100g': 250.4,
        proteins_100g: 8.25,
        fat_100g: 3.1,
        carbohydrates_100g: 45,
        sodium_100g: 0.4,   // grams
        fiber_100g: 2.34,
      },
      brands: 'Meiji, 明治HD',
      serving_quantity: 35,
      serving_quantity_unit: 'g',
    }));
    expect(p).not.toBeNull();
    expect(p!.name).toBe('テスト食品');
    expect(p!.brand).toBe('Meiji');
    expect(p!.per100g).toEqual({
      calories: 250, protein: 8.3, fat: 3.1, carbs: 45,
      sodiumMg: 400, fiberG: 2.3,
    });
    expect(p!.servingG).toBe(35);
  });

  it('falls back from salt_100g to sodium via ÷2.54', () => {
    const p = normalizeOffProduct(offResponse({
      nutriments: { 'energy-kcal_100g': 100, salt_100g: 1.27 },
    }));
    // 1.27 g salt / 2.54 = 0.5 g sodium = 500 mg
    expect(p!.per100g.sodiumMg).toBe(500);
  });

  it('prefers sodium_100g over salt_100g when both exist', () => {
    const p = normalizeOffProduct(offResponse({
      nutriments: { 'energy-kcal_100g': 100, sodium_100g: 0.2, salt_100g: 9.99 },
    }));
    expect(p!.per100g.sodiumMg).toBe(200);
  });

  it('returns null when kcal is missing (energy_100g kJ alone is not enough)', () => {
    expect(normalizeOffProduct(offResponse({
      nutriments: { energy_100g: 1046, proteins_100g: 8 },
    }))).toBeNull();
  });

  it('returns null for missing product, status 0, or empty name', () => {
    expect(normalizeOffProduct({ status: 0 })).toBeNull();
    expect(normalizeOffProduct({ status: 1 })).toBeNull();
    expect(normalizeOffProduct(offResponse({ name: '  ' }))).toBeNull();
    expect(normalizeOffProduct(null)).toBeNull();
    expect(normalizeOffProduct('nope')).toBeNull();
  });

  it('accepts numeric strings (OFF serves them) and omits absent micros', () => {
    const p = normalizeOffProduct(offResponse({
      nutriments: { 'energy-kcal_100g': '128', proteins_100g: '4.5' },
      serving_quantity: '30',
    }));
    expect(p!.per100g.calories).toBe(128);
    expect(p!.per100g.protein).toBe(4.5);
    expect(p!.per100g.sodiumMg).toBeUndefined();
    expect(p!.per100g.fiberG).toBeUndefined();
    expect(p!.servingG).toBe(30);
  });

  it('ignores non-gram serving quantities', () => {
    const p = normalizeOffProduct(offResponse({
      serving_quantity: 250, serving_quantity_unit: 'ml',
    }));
    expect(p!.servingG).toBeUndefined();
  });

  it('defaults missing macros to 0 (OFF omits zero values)', () => {
    const p = normalizeOffProduct(offResponse({
      nutriments: { 'energy-kcal_100g': 42 },
    }));
    expect(p!.per100g).toEqual({ calories: 42, protein: 0, fat: 0, carbs: 0 });
  });
});
