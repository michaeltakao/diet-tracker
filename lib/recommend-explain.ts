/**
 * XAI label mapping for the content-based affinity model.
 *
 * Converts raw feature keys (produced by foodFeatures / exerciseFeatures in
 * lib/recommend-preference.ts) into user-facing Japanese labels and computes
 * per-item explanation factors for the "なぜこれ？" drawer.
 *
 * Design note: label mapping is deliberately simple (prefix match + fallback)
 * so it degrades gracefully when the LLM generates novel Japanese food names.
 */

import type { AffinityModel } from '@/lib/recommend-preference';
import { foodFeatures, exerciseFeatures } from '@/lib/recommend-preference';

export interface ExplanationFactor {
  label: string;           // Japanese user-facing label
  weight: number;          // signed affinity weight
  direction: 'positive' | 'negative';
}

// ── Feature → Japanese label ─────────────────────────────────────────────────

const MACRO_LABELS: Record<string, string> = {
  '高タンパク':  'タンパク質目標に合致',
  'タンパク':    'タンパク質目標に合致',
  '低脂質':      '低脂質で目標に合致',
  '低糖質':      '低糖質で目標に合致',
  '低塩':        '塩分控えめ',
  '食物繊維':    '食物繊維が豊富',
  'ビタミン':    'ビタミンが豊富',
  'カルシウム':  'カルシウムが豊富',
  '鉄分':        '鉄分が豊富',
  'オメガ':      'オメガ3脂肪酸を含む',
  '高カロリー':  'カロリー補給に適切',
  '低カロリー':  '低カロリーで制限内',
  '高炭水化':    '炭水化物で即時エネルギー',
  '発酵':        '腸内環境に有益',
  'プロバイオ':  '腸内環境に有益',
  'strength':    'ウェイトトレーニング傾向',
  'cardio':      '有酸素運動傾向',
  'flexibility': 'ストレッチ・柔軟傾向',
};

/** Map a raw feature key to a Japanese label. */
function featureToLabel(feature: string): string {
  if (feature.startsWith('name:')) {
    return '過去の食事・運動パターン';
  }
  if (feature.startsWith('macro:')) {
    const token = feature.slice('macro:'.length);
    for (const [key, label] of Object.entries(MACRO_LABELS)) {
      if (token.includes(key.toLowerCase()) || key.toLowerCase().includes(token)) {
        return label;
      }
    }
    return `栄養素: ${token}`;
  }
  if (feature.startsWith('cat:')) {
    const cat = feature.slice('cat:'.length);
    return MACRO_LABELS[cat] ?? `カテゴリ: ${cat}`;
  }
  return feature;
}

// ── Per-item explanation ─────────────────────────────────────────────────────

/**
 * Compute explanation factors for a single food item.
 *
 * Parameters
 * ----------
 * name          : food name (Japanese)
 * macroHighlight: macro label string (e.g. "高タンパク・低脂質")
 * model         : learned affinity model
 * topN          : maximum number of factors to return (default 5)
 *
 * Returns
 * -------
 * Array of ExplanationFactor sorted by |weight| descending.
 * Zero-weight features are omitted. Empty if the model has no signal for
 * this item (new user or unseen food).
 */
export function explainFood(
  name: string,
  macroHighlight: string | undefined,
  model: AffinityModel,
  topN = 5,
): ExplanationFactor[] {
  return _explain(foodFeatures(name, macroHighlight), model, topN);
}

/**
 * Compute explanation factors for a single exercise item.
 *
 * Parameters
 * ----------
 * name    : exercise name (Japanese)
 * category: exercise category ('strength' | 'cardio' | 'flexibility' | 'other')
 * model   : learned affinity model
 * topN    : maximum number of factors to return (default 5)
 */
export function explainExercise(
  name: string,
  category: string,
  model: AffinityModel,
  topN = 5,
): ExplanationFactor[] {
  return _explain(exerciseFeatures(name, category), model, topN);
}

function _explain(
  features: string[],
  model: AffinityModel,
  topN: number,
): ExplanationFactor[] {
  if (features.length === 0) return [];

  // Collapse duplicate labels (pick max |weight| per label)
  const byLabel = new Map<string, number>();
  for (const f of features) {
    const w = model.weights.get(f) ?? 0;
    if (w === 0) continue;
    const label = featureToLabel(f);
    const prev  = byLabel.get(label) ?? 0;
    if (Math.abs(w) > Math.abs(prev)) byLabel.set(label, w);
  }

  return [...byLabel.entries()]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, topN)
    .map(([label, weight]) => ({
      label,
      weight,
      direction: weight >= 0 ? 'positive' : 'negative',
    }));
}
