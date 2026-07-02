/**
 * Phase B — content-based preference model + hybrid re-ranking.
 *
 * Recommendations are LLM-generated (see app/api/recommend/route.ts) and already
 * passed through the deterministic safety gate (lib/recommend-safety.ts). This
 * module is a *pure*, deterministic post-processor that re-orders the surviving
 * safe items by a per-user content-based affinity learned from:
 *
 *   1. revealed preference  — the user's food/workout history (consumed ⇒ mild +),
 *   2. explicit feedback    — accept / reject / favorite on past recommendations.
 *
 * It NEVER adds or removes items (safety already decided membership); it only
 * permutes order, so it cannot reintroduce a contraindicated food. All scoring is
 * explainable: every feature's contribution can be inspected via {@link explainAffinity}.
 *
 * Design notes / assumptions:
 *  - No morphological analyzer is used (dependency-free, deterministic). Japanese
 *    food names are treated as a single `name:<full name>` feature; `macroHighlight`
 *    is split on its natural delimiter `・`, and exercises contribute their category.
 *    This is coarse but stable; a tokenizer can be swapped in behind the same API.
 *  - "Consumption = positive signal" is the standard content-based assumption; it is
 *    weaker than explicit feedback, hence the smaller weight.
 */

import type {
  Recommendation,
  RecommendedExercise,
  RecommendedFood,
  RecommendationFeedback,
} from '@/lib/types';

/** Signals the affinity model learns from. */
export interface PreferenceSignals {
  /** Recent food log names (revealed preference). */
  foodHistory: readonly string[];
  /** Recent workouts (name + category). */
  workoutHistory: ReadonlyArray<{ name: string; category: string }>;
  /** Explicit accept / reject / favorite events. */
  feedback: readonly RecommendationFeedback[];
}

/** A learned, explainable content-based affinity model: feature → weight. */
export interface AffinityModel {
  weights: Map<string, number>;
}

/** A single feature's contribution, for explainability. */
export interface AffinityExplanation {
  feature: string;
  weight: number;
}

// Signal weights. Explicit feedback dominates revealed preference; rejection is
// asymmetric (penalised harder than acceptance rewards), matching the product goal
// of not re-surfacing disliked items.
const W_HISTORY = 1;
const W_ACCEPT = 2;
const W_FAVORITE = 4;
const W_REJECT = -3;

const FEATURE_SPLIT = /[・/／\s,、]+/u;

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/** Content features for a food: its name plus each macro-highlight token. */
export function foodFeatures(name: string, macroHighlight?: string | null): string[] {
  const features: string[] = [];
  const n = normalize(name);
  if (n) features.push(`name:${n}`);
  if (macroHighlight) {
    for (const part of macroHighlight.split(FEATURE_SPLIT)) {
      const token = normalize(part);
      if (token) features.push(`macro:${token}`);
    }
  }
  return features;
}

/** Content features for an exercise: its name plus its category. */
export function exerciseFeatures(name: string, category: string): string[] {
  const features: string[] = [];
  const n = normalize(name);
  if (n) features.push(`name:${n}`);
  const c = normalize(category);
  if (c) features.push(`cat:${c}`);
  return features;
}

/**
 * Build the affinity model from preference signals.
 *
 * @returns A model mapping each observed feature to a cumulative weight. The same
 *   inputs always produce the same model (order-independent across distinct features).
 */
export function buildAffinityModel(signals: PreferenceSignals): AffinityModel {
  const weights = new Map<string, number>();
  const bump = (feature: string, w: number): void => {
    weights.set(feature, (weights.get(feature) ?? 0) + w);
  };

  for (const name of signals.foodHistory) {
    for (const f of foodFeatures(name)) bump(f, W_HISTORY);
  }
  for (const w of signals.workoutHistory) {
    for (const f of exerciseFeatures(w.name, w.category)) bump(f, W_HISTORY);
  }
  for (const fb of signals.feedback) {
    const w =
      fb.kind === 'favorite' ? W_FAVORITE : fb.kind === 'accept' ? W_ACCEPT : W_REJECT;
    const features =
      fb.itemType === 'food'
        ? foodFeatures(fb.itemName, fb.macroHighlight)
        : exerciseFeatures(fb.itemName, fb.category ?? '');
    for (const f of features) bump(f, w);
  }

  return { weights };
}

/** Mean weight over a feature set (length-normalised so long names aren't favoured). */
function scoreFeatures(features: readonly string[], model: AffinityModel): number {
  if (features.length === 0) return 0;
  let sum = 0;
  for (const f of features) sum += model.weights.get(f) ?? 0;
  return sum / features.length;
}

/** Affinity score for a recommended food (higher = better fit to learned preference). */
export function scoreFood(food: RecommendedFood, model: AffinityModel): number {
  return scoreFeatures(foodFeatures(food.name, food.macroHighlight), model);
}

/** Affinity score for a recommended exercise. */
export function scoreExercise(exercise: RecommendedExercise, model: AffinityModel): number {
  return scoreFeatures(exerciseFeatures(exercise.name, exercise.category), model);
}

/** Stable descending sort by score; ties keep original order (LLM order as prior). */
function stableSortByScoreDesc<T>(items: readonly T[], score: (item: T) => number): T[] {
  return items
    .map((item, index) => ({ item, index, s: score(item) }))
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map((x) => x.item);
}

/**
 * Re-rank a (already safety-filtered) recommendation by learned affinity.
 *
 * Pure: returns a new {@link Recommendation} with `foods` and `exercises` reordered.
 * The set of items is preserved exactly — only their order changes — so the safety
 * gate's membership decision is never altered. Empty / unseen items keep their
 * relative LLM order via the stable tie-break.
 */
export function rankRecommendation(
  recommendation: Recommendation,
  model: AffinityModel,
): Recommendation {
  return {
    ...recommendation,
    foods: stableSortByScoreDesc(recommendation.foods, (f) => scoreFood(f, model)),
    exercises: stableSortByScoreDesc(recommendation.exercises, (e) =>
      scoreExercise(e, model),
    ),
  };
}

/**
 * Top contributing features by absolute weight, for explainability/debugging.
 *
 * @param topN - Maximum number of features to return.
 * @returns Features sorted by |weight| descending, then feature name ascending
 *   (deterministic). Zero-weight features are omitted.
 */
export function explainAffinity(model: AffinityModel, topN = 5): AffinityExplanation[] {
  return [...model.weights.entries()]
    .filter(([, w]) => w !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || (a[0] < b[0] ? -1 : 1))
    .slice(0, topN)
    .map(([feature, weight]) => ({ feature, weight }));
}
