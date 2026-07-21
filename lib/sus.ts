/**
 * System Usability Scale (SUS) scoring — Brooke, 1996.
 *
 * Standard 10-item, 5-point Likert instrument. Odd-numbered items (1,3,5,7,9)
 * are positively worded ("I think I would like to use this system
 * frequently"); even-numbered items (2,4,6,8,10) are negatively worded
 * ("I found the system unnecessarily complex").
 *
 * Per-item contribution:
 *   odd  item: score - 1
 *   even item: 5 - score
 * Sum of contributions ranges 0-40; total = sum * 2.5, ranging 0-100.
 *
 * Pure function — no I/O. app/api/sus/route.ts calls this server-side so the
 * client can never submit a forged total_score.
 */

export interface SusItemScores {
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  item7: number;
  item8: number;
  item9: number;
  item10: number;
}

const ODD_KEYS: readonly (keyof SusItemScores)[] = ['item1', 'item3', 'item5', 'item7', 'item9'];
const EVEN_KEYS: readonly (keyof SusItemScores)[] = ['item2', 'item4', 'item6', 'item8', 'item10'];

/** Throws if any item is outside the valid 1-5 range — callers must validate first. */
export function scoreSus(items: SusItemScores): number {
  let sum = 0;
  for (const key of ODD_KEYS) {
    const v = items[key];
    if (!Number.isInteger(v) || v < 1 || v > 5) {
      throw new RangeError(`SUS ${key} out of range: ${v}`);
    }
    sum += v - 1;
  }
  for (const key of EVEN_KEYS) {
    const v = items[key];
    if (!Number.isInteger(v) || v < 1 || v > 5) {
      throw new RangeError(`SUS ${key} out of range: ${v}`);
    }
    sum += 5 - v;
  }
  return sum * 2.5;
}
