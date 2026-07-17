/**
 * Shared per-category presentation (icons + colors) for the gamification
 * dashboard (design phase 5). UI-only — the data shape lives in
 * lib/dashboard-data.ts.
 *
 * `ring` fills are decorative (icon discs, ring segments): white icons on
 * them are aria-hidden, so their contrast is not load-bearing. Text next to
 * them uses the semantic text tokens instead.
 */

import { Apple, Dumbbell, HeartPulse, Stethoscope, type LucideIcon } from 'lucide-react';
import type { CategoryKey } from '@/lib/dashboard-data';
import type { TranslationKey } from '@/lib/i18n';
import type { ProgressBarVariant } from '@/components/ui/ProgressBar';

export interface CategoryMeta {
  icon: LucideIcon;
  /** CSS color for decorative fills (SVG strokes, icon discs). */
  ring: string;
  barVariant: ProgressBarVariant;
  labelKey: TranslationKey;
}

export const CATEGORY_META: Record<CategoryKey, CategoryMeta> = {
  meal:     { icon: Apple,       ring: 'var(--brand-500)', barVariant: 'brand',  labelKey: 'categoryMeal' },
  exercise: { icon: Dumbbell,    ring: 'var(--fox)',       barVariant: 'fox',    labelKey: 'categoryExercise' },
  vital:    { icon: HeartPulse,  ring: 'var(--info)',      barVariant: 'info',   labelKey: 'categoryVital' },
  symptom:  { icon: Stethoscope, ring: 'var(--danger)',    barVariant: 'danger', labelKey: 'categorySymptom' },
};
