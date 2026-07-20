/**
 * Open Food Facts (OFF) product normalization — pure functions, no I/O.
 *
 * The /api/product-lookup route fetches the OFF v2 product API and passes the
 * parsed JSON here. OFF nutriment values are per 100 g with these quirks:
 *   - energy is `energy-kcal_100g` (kcal) — `energy_100g` alone is kJ
 *   - `sodium_100g` is in GRAMS (converted to mg here)
 *   - when sodium is absent, `salt_100g` (食塩相当量, g) ÷ 2.54 gives sodium g
 * A product without a name or kcal value is unusable for logging → null.
 */

export interface NormalizedProduct {
  name: string;
  brand?: string;
  /** Nutrition per 100 g of product. */
  per100g: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    sodiumMg?: number;
    fiberG?: number;
  };
  /** Declared serving size in grams, when the product provides one. */
  servingG?: number;
}

/**
 * GS1 mod-10 check digit: from the rightmost digit, alternate ×3/×1 weights
 * (rightmost non-check digit gets ×3), sum, and the check digit is
 * `(10 - sum % 10) % 10`. Same algorithm for EAN-8/13 and UPC-A/GTIN-14.
 */
function hasValidCheckDigit(barcode: string): boolean {
  const digits = barcode.split('').map(Number);
  const check = digits[digits.length - 1];
  const body = digits.slice(0, -1).reverse();
  const sum = body.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** EAN-8 … EAN-13/GTIN-14 range (also covers UPC-A, 12) with a valid GS1 check digit. */
export function isValidBarcode(barcode: string): boolean {
  return /^\d{8,14}$/.test(barcode) && hasValidCheckDigit(barcode);
}

/** Grams of salt (食塩相当量) per gram of sodium. */
const SALT_PER_SODIUM = 2.54;

const round1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * Finite, non-negative-number coercion: OFF sometimes serves numeric strings,
 * and occasionally malformed/negative values — a negative kcal or nutrient
 * is nonsensical and treated the same as absent.
 */
function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v >= 0 ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n >= 0 ? n : null;
  }
  return null;
}

interface OffNutriments {
  'energy-kcal_100g'?: unknown;
  proteins_100g?: unknown;
  fat_100g?: unknown;
  carbohydrates_100g?: unknown;
  sodium_100g?: unknown;
  salt_100g?: unknown;
  fiber_100g?: unknown;
}

interface OffProduct {
  product_name?: unknown;
  brands?: unknown;
  nutriments?: OffNutriments;
  serving_quantity?: unknown;
  serving_quantity_unit?: unknown;
}

interface OffResponse {
  status?: unknown;
  product?: OffProduct;
}

/**
 * Normalize an OFF v2 product response into logging-ready per-100 g values.
 *
 * Parameters
 * ----------
 * json : unknown
 *     Parsed body of `GET /api/v2/product/{barcode}.json`.
 *
 * Returns
 * -------
 * NormalizedProduct | null
 *     null when the product is missing, unnamed, or has no kcal value —
 *     macros default to 0 (OFF omits zero values), micros stay undefined
 *     when absent so the UI can distinguish "0" from "unknown".
 */
export function normalizeOffProduct(json: unknown): NormalizedProduct | null {
  if (typeof json !== 'object' || json === null) return null;
  const { status, product } = json as OffResponse;
  if (status !== 1 || typeof product !== 'object' || product === null) return null;

  const name = typeof product.product_name === 'string' ? product.product_name.trim() : '';
  if (!name) return null;

  const n = product.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']);
  if (kcal == null) return null;

  const sodiumG = num(n.sodium_100g);
  const saltG = num(n.salt_100g);
  const sodiumMg =
    sodiumG != null ? Math.round(sodiumG * 1000)
    : saltG != null ? Math.round((saltG / SALT_PER_SODIUM) * 1000)
    : undefined;

  const fiber = num(n.fiber_100g);

  const brand = typeof product.brands === 'string'
    ? product.brands.split(',')[0]?.trim()
    : '';

  // serving_quantity is grams when the unit is g/unset (OFF defaults to g).
  const servingQty = num(product.serving_quantity);
  const servingUnit = typeof product.serving_quantity_unit === 'string'
    ? product.serving_quantity_unit.toLowerCase()
    : 'g';
  const servingG =
    servingQty != null && servingQty > 0 && (servingUnit === 'g' || servingUnit === '')
      ? round1(servingQty)
      : undefined;

  return {
    name,
    ...(brand ? { brand } : {}),
    per100g: {
      calories: Math.round(kcal),
      protein: round1(num(n.proteins_100g) ?? 0),
      fat: round1(num(n.fat_100g) ?? 0),
      carbs: round1(num(n.carbohydrates_100g) ?? 0),
      ...(sodiumMg != null ? { sodiumMg } : {}),
      ...(fiber != null ? { fiberG: round1(fiber) } : {}),
    },
    ...(servingG != null ? { servingG } : {}),
  };
}
