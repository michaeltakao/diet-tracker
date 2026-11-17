/**
 * Request validation for /api/nutritionist (extracted from the route so it can
 * be unit-tested — Next.js forbids non-handler exports from route.ts).
 */
import { parseWeightKg } from '@/lib/medication-rules';

export interface EntryIn {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  sodiumMg?: number;
  fiberG?: number;
}

export interface GoalsIn {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export const MAX_ENTRIES = 60;
const MAX_NAME_LEN = 80;
const MAX_VALUE = 99_999;
export const MAX_HEALTH_ITEMS = 20;
export const MAX_HEALTH_ITEM_LEN = 40;

export interface ParsedBody {
  entries: EntryIn[];
  goals: GoalsIn;
  healthConditions: string[];
  medications: string[];
  weightKg: number | null;
}

function numOk(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_VALUE;
}

/**
 * Optional string list: undefined/null → []; otherwise an array of non-empty
 * strings, ≤ MAX_HEALTH_ITEMS items, each trimmed and cut to
 * MAX_HEALTH_ITEM_LEN. Returns null on a shape violation.
 */
function parseStringList(v: unknown): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > MAX_HEALTH_ITEMS) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string') return null;
    const t = item.trim().slice(0, MAX_HEALTH_ITEM_LEN);
    if (t !== '') out.push(t);
  }
  return out;
}

/** Validate + sanitize the client payload; null on any shape violation. */
export function parseBody(body: unknown): ParsedBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const { entries, goals, healthConditions, medications, weightKg } = body as {
    entries?: unknown; goals?: unknown;
    healthConditions?: unknown; medications?: unknown; weightKg?: unknown;
  };
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_ENTRIES) return null;
  if (typeof goals !== 'object' || goals === null) return null;

  const conds = parseStringList(healthConditions);
  const meds = parseStringList(medications);
  if (conds === null || meds === null) return null;
  // An invalid weight is dropped (not rejected): the cap then falls back to
  // the per-kg prompt line, same as coach/weekly-report.
  const weight = parseWeightKg(weightKg);

  const g = goals as Record<string, unknown>;
  if (!numOk(g.calories) || !numOk(g.protein) || !numOk(g.fat) || !numOk(g.carbs)) return null;

  const clean: EntryIn[] = [];
  for (const raw of entries) {
    if (typeof raw !== 'object' || raw === null) return null;
    const e = raw as Record<string, unknown>;
    if (typeof e.name !== 'string' || e.name.trim() === '') return null;
    if (!numOk(e.calories) || !numOk(e.protein) || !numOk(e.fat) || !numOk(e.carbs)) return null;
    clean.push({
      name: e.name.trim().slice(0, MAX_NAME_LEN),
      calories: e.calories,
      protein: e.protein,
      fat: e.fat,
      carbs: e.carbs,
      ...(numOk(e.sodiumMg) ? { sodiumMg: e.sodiumMg } : {}),
      ...(numOk(e.fiberG) ? { fiberG: e.fiberG } : {}),
    });
  }
  return {
    entries: clean,
    goals: { calories: g.calories, protein: g.protein, fat: g.fat, carbs: g.carbs },
    healthConditions: conds,
    medications: meds,
    weightKg: weight,
  };
}
