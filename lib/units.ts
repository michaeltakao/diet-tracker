/**
 * Weight-unit preference and display conversion.
 *
 * Storage is ALWAYS in kilograms — this module only converts at the display
 * layer, so switching units never mutates stored data. Mirrors the kg/lbs
 * toggle in 筋トレMEMO.
 */

import { useSyncExternalStore } from 'react';

export type WeightUnit = 'kg' | 'lbs';

export const UNIT_STORAGE_KEY = 'diet-tracker:weight-unit';

const KG_PER_LB = 0.45359237;

/** Convert kilograms to pounds. */
export function kgToLbs(kg: number): number {
  return kg / KG_PER_LB;
}

/** Convert pounds to kilograms. */
export function lbsToKg(lbs: number): number {
  return lbs * KG_PER_LB;
}

/**
 * Convert a stored kg value into the user's display unit.
 *
 * @param kg   - Value in kilograms (canonical storage unit).
 * @param unit - Target display unit.
 * @returns Numeric value in the display unit, rounded to 0.1.
 */
export function toDisplay(kg: number, unit: WeightUnit): number {
  const v = unit === 'lbs' ? kgToLbs(kg) : kg;
  return Math.round(v * 10) / 10;
}

/**
 * Format a stored kg value for display, with unit suffix.
 *
 * @param kg   - Value in kilograms.
 * @param unit - Target display unit.
 * @returns e.g. "60 kg" or "132.3 lbs". Trailing ".0" is trimmed.
 */
export function formatWeight(kg: number, unit: WeightUnit): string {
  const v = toDisplay(kg, unit);
  const text = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return `${text} ${unit}`;
}

/** Read the stored unit preference (SSR-safe; defaults to 'kg'). */
export function getStoredUnit(): WeightUnit {
  if (typeof window === 'undefined') return 'kg';
  return localStorage.getItem(UNIT_STORAGE_KEY) === 'lbs' ? 'lbs' : 'kg';
}

/** Subscribe to cross-tab (`storage`) and same-tab (custom event) unit changes. */
function subscribeUnit(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener('diet-tracker:unit-change', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('diet-tracker:unit-change', onChange);
  };
}

/** Server snapshot — storage is unavailable during SSR, so default to kg. */
const getServerUnit = (): WeightUnit => 'kg';

/**
 * React hook for the weight-unit preference.
 *
 * Backed by `useSyncExternalStore`: the snapshot reads localStorage and stays in
 * sync across tabs/components via the `storage` event and a same-tab custom event
 * dispatched by setUnit. SSR/first-hydration render resolves to 'kg' to avoid a
 * hydration mismatch, then re-reads the stored preference on the client.
 */
export function useWeightUnit(): { unit: WeightUnit; setUnit: (u: WeightUnit) => void } {
  const unit = useSyncExternalStore(subscribeUnit, getStoredUnit, getServerUnit);

  const setUnit = (u: WeightUnit) => {
    localStorage.setItem(UNIT_STORAGE_KEY, u);
    // Notify this tab's subscribers; the `storage` event covers other tabs.
    window.dispatchEvent(new Event('diet-tracker:unit-change'));
  };

  return { unit, setUnit };
}
