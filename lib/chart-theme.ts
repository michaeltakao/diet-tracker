/**
 * Named colour constants for the data visualisations.
 *
 * Charts render to SVG (hand-rolled in WeightChart, Recharts in PFCDonut),
 * which takes raw colour strings rather than Tailwind utility classes — so the
 * semantic design tokens in globals.css cannot reach here and literal hex
 * values are the correct representation. Centralising them removes repeated
 * literals (the weight-line colour alone appeared five times in WeightChart)
 * and gives the charts a single palette to theme from later.
 */

/** Weight trend chart — components/WeightChart.tsx. */
export const WEIGHT_CHART = {
  /** indigo-500 — trend line, dots, area-fill gradient, single-point label. */
  line:      '#6366f1',
  /** green-300 — dashed goal marker. */
  goalLine:  '#86efac',
  /** gray-400 — first/last date axis labels. */
  axisLabel: '#9ca3af',
} as const;

/** Macro (PFC) breakdown donut — components/PFCDonut.tsx. */
export const MACRO_COLORS = {
  protein: '#22c55e',
  fat:     '#f59e0b',
  carbs:   '#3b82f6',
  empty:   '#e2e8f0',
} as const;
