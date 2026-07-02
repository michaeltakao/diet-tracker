/**
 * Deterministic safety gate for the personalized recommender.
 *
 * The LLM is responsible for natural-language generation only. Every
 * safety-relevant decision — which foods are contraindicated, which warnings
 * are mandatory, how far a macro target may be adjusted — is made here by
 * pure, auditable functions grounded in `lib/medication-rules.ts`.
 *
 * This is defense-in-depth: `buildSafetyReport` injects the rules into the
 * prompt so the LLM avoids unsafe suggestions at the source, and
 * `filterRecommendation` re-screens the LLM output so an unsafe suggestion
 * that slips through is still removed before reaching the user.
 *
 * Informational only — not a substitute for medical advice.
 */

import type {
  UserHealthProfile,
  DailyGoals,
  Recommendation,
  RecommendedFood,
  SafetyNote,
} from '@/lib/types';
import {
  getConditionRules,
  getMedicationRules,
  buildHealthContextPrompt,
} from '@/lib/medication-rules';

// ── Renal protein cap ───────────────────────────────────────────────────────

/** CKD protein restriction (g/kg/day). Conservative end of the 0.6–0.8 range. */
const CKD_PROTEIN_G_PER_KG = 0.8;

// ── Food-level rules ────────────────────────────────────────────────────────

interface FoodRule {
  /** What activates this rule for a given user. */
  trigger:  { kind: 'medication' | 'condition'; keywords: string[]; ref: string };
  /** Substrings of a food name that this rule matches against. */
  terms:    string[];
  /** `contraindicated` ⇒ remove the food entirely; `caution` ⇒ annotate only. */
  severity: 'contraindicated' | 'caution';
  message:  string;
}

/**
 * Hard food↔condition/medication rules. Absolute "禁忌" interactions are
 * `contraindicated`; timing/quantity concerns are `caution`. All entries are
 * grounded in CONDITION_RULES / MEDICATION_RULES in lib/medication-rules.ts.
 */
const FOOD_RULES: FoodRule[] = [
  // ── Medication: absolute contraindications ──
  {
    trigger: { kind: 'medication', keywords: ['ワーファリン', 'ワルファリン', 'warfarin'], ref: 'ワーファリン' },
    terms: ['納豆', 'クロレラ', '青汁'],
    severity: 'contraindicated',
    message: 'ワーファリン服用中は大量のビタミンKが薬効を大幅に低下させるため禁忌です',
  },
  {
    trigger: { kind: 'medication', keywords: ['スタチン', 'atorvastatin', 'rosuvastatin', 'クレストール', 'リピトール', 'リバロ', 'メバロチン'], ref: 'スタチン系' },
    terms: ['グレープフルーツ'],
    severity: 'contraindicated',
    message: 'スタチン服用中はグレープフルーツが薬物代謝を阻害し筋障害（ミオパチー）リスクを高めるため避けてください',
  },
  {
    trigger: { kind: 'medication', keywords: ['アムロジピン', 'カルシウム拮抗薬', 'Ca拮抗薬', 'ニフェジピン'], ref: 'Ca拮抗薬' },
    terms: ['グレープフルーツ'],
    severity: 'contraindicated',
    message: 'Ca拮抗薬服用中はグレープフルーツが血中濃度を上げるため避けてください',
  },
  // ── Medication: timing/quantity cautions ──
  {
    trigger: { kind: 'medication', keywords: ['テトラサイクリン', 'ドキシサイクリン', 'ミノサイクリン'], ref: 'テトラサイクリン系' },
    terms: ['牛乳', 'ヨーグルト', 'チーズ'],
    severity: 'caution',
    message: 'テトラサイクリン系は乳製品のカルシウムで吸収が低下します。服用の前後2時間は避けてください',
  },
  {
    trigger: { kind: 'medication', keywords: ['ビスホスホネート', 'アレンドロン', 'リセドロン', 'ボナロン', 'フォサマック', 'アクトネル'], ref: 'ビスホスホネート' },
    terms: ['牛乳', 'カルシウム', 'ジュース'],
    severity: 'caution',
    message: 'ビスホスホネートは乳製品・カルシウムと同時摂取で吸収がほぼゼロになります。起床時に水で服用してください',
  },
  {
    trigger: { kind: 'medication', keywords: ['レボチロキシン', 'チラーヂン', 'チロナミン'], ref: 'レボチロキシン' },
    terms: ['コーヒー', '牛乳', '大豆', '豆乳', 'プロテイン'],
    severity: 'caution',
    message: 'レボチロキシン服用後1時間以内のコーヒー・乳製品・大豆・プロテインは吸収を妨げます',
  },
  // ── Condition cautions ──
  {
    trigger: { kind: 'condition', keywords: ['腎臓病'], ref: '腎臓病' },
    terms: ['プロテイン', 'ささみ', '鶏むね', 'プロテインバー'],
    severity: 'caution',
    message: '腎臓病ではタンパク質過多が腎臓の負担になります。高タンパク食品・サプリは主治医の指示量を守ってください',
  },
  {
    trigger: { kind: 'condition', keywords: ['痛風'], ref: '痛風' },
    terms: ['レバー', 'イワシ', 'アジ', 'エビ', 'ビール', '白子', 'あん肝', 'カツオ'],
    severity: 'caution',
    message: '痛風ではプリン体の多い食品が尿酸値を上げます。摂取量に注意してください',
  },
  {
    trigger: { kind: 'condition', keywords: ['高血圧'], ref: '高血圧' },
    terms: ['ラーメン', 'カップ麺', '漬物', '梅干し', 'ハム', 'ベーコン', 'ウインナー'],
    severity: 'caution',
    message: '高血圧では塩分過多に注意してください（1日6g未満が目標）',
  },
  {
    trigger: { kind: 'condition', keywords: ['心臓病'], ref: '心臓病' },
    terms: ['ラーメン', 'カップ麺', '漬物', 'ハム', 'ベーコン'],
    severity: 'caution',
    message: '心臓病では塩分・飽和脂肪酸の過多に注意してください',
  },
  {
    trigger: { kind: 'condition', keywords: ['糖尿病'], ref: '糖尿病' },
    terms: ['ケーキ', '菓子パン', 'ジュース', '清涼飲料', 'あんぱん', 'ドーナツ', 'アイス'],
    severity: 'caution',
    message: '糖尿病では高GI・高糖質食品が食後血糖スパイクを招きます。量とタイミングに注意してください',
  },
];

// ── Trigger matching ────────────────────────────────────────────────────────

/** Bidirectional, case-insensitive medication match (mirrors getMedicationRules). */
function userHasMedication(keywords: string[], medications: string[]): boolean {
  return keywords.some(kw =>
    medications.some(med =>
      med.toLowerCase().includes(kw.toLowerCase()) ||
      kw.toLowerCase().includes(med.toLowerCase()),
    ),
  );
}

function ruleApplies(rule: FoodRule, profile: UserHealthProfile): boolean {
  const conditions  = profile.healthConditions ?? [];
  const medications = profile.medications ?? [];
  return rule.trigger.kind === 'medication'
    ? userHasMedication(rule.trigger.keywords, medications)
    : conditions.includes(rule.trigger.keywords[0]);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Screen a single food name against the user's conditions and medications.
 *
 * Parameters
 * ----------
 * name : food name to screen (Japanese)
 * profile : the user's health profile
 *
 * Returns
 * -------
 * allowed : false iff any matched rule is `contraindicated`
 * notes : all matched safety notes (both contraindicated and caution)
 */
export function screenFood(
  name: string,
  profile: UserHealthProfile,
): { allowed: boolean; notes: SafetyNote[] } {
  const notes: SafetyNote[] = [];
  for (const rule of FOOD_RULES) {
    if (!ruleApplies(rule, profile)) continue;
    if (rule.terms.some(term => name.includes(term))) {
      notes.push({
        severity: rule.severity,
        message:  rule.message,
        source:   rule.trigger.kind,
        ref:      rule.trigger.ref,
      });
    }
  }
  const allowed = !notes.some(n => n.severity === 'contraindicated');
  return { allowed, notes };
}

/**
 * Clamp an LLM-proposed macro target to condition-based hard caps.
 *
 * Currently enforces the CKD protein ceiling (0.8 g/kg/day). Returns the
 * (possibly unchanged) macros plus a human-readable record of caps applied.
 */
export function clampMacros(
  adjusted: DailyGoals,
  profile: UserHealthProfile,
  weightKg: number | null,
): { macros: DailyGoals; capsApplied: string[] } {
  const conditions = profile.healthConditions ?? [];
  const capsApplied: string[] = [];
  let macros = { ...adjusted };

  if (conditions.includes('腎臓病') && weightKg && weightKg > 0) {
    const cap = Math.round(CKD_PROTEIN_G_PER_KG * weightKg);
    if (macros.protein > cap) {
      capsApplied.push(`腎臓病: タンパク質上限 ${cap}g/日（${CKD_PROTEIN_G_PER_KG} g/kg）を適用`);
      macros = { ...macros, protein: cap };
    }
  }

  return { macros, capsApplied };
}

/**
 * Build the deterministic safety context for a user: text to inject into the
 * LLM prompt, warnings that must always be present, and the absolute set of
 * contraindicated food terms (used both in the prompt and as the post-filter).
 */
export function buildSafetyReport(
  profile: UserHealthProfile,
  weightKg: number | null,
): { promptInjection: string; mandatoryWarnings: string[]; contraindicatedTerms: string[] } {
  const conditions  = profile.healthConditions ?? [];
  const medications = profile.medications ?? [];

  // Mandatory warnings — always surfaced regardless of what the LLM returns.
  const condRules = getConditionRules(conditions);
  const medRules  = getMedicationRules(medications);
  const mandatoryWarnings = [...new Set([
    ...condRules.flatMap(r => r.nutritionWarnings),
    ...medRules.flatMap(r => r.foodInteractions.map(f => `[${r.displayName}] ${f}`)),
  ])];

  // Absolute contraindicated terms that apply to this specific user.
  const contraindicatedTerms = [...new Set(
    FOOD_RULES
      .filter(rule => rule.severity === 'contraindicated' && ruleApplies(rule, profile))
      .flatMap(rule => rule.terms),
  )];

  // Prompt injection: existing health context + explicit ban list + renal cap.
  const parts: string[] = [];
  const healthCtx = buildHealthContextPrompt(conditions, medications);
  if (healthCtx) parts.push(healthCtx);
  if (contraindicatedTerms.length) {
    parts.push(`■ 絶対に推薦してはいけない食品（禁忌）: ${contraindicatedTerms.join('、')}`);
  }
  if (conditions.includes('腎臓病') && weightKg && weightKg > 0) {
    parts.push(`■ 腎臓病のためタンパク質は1日 ${Math.round(CKD_PROTEIN_G_PER_KG * weightKg)}g（${CKD_PROTEIN_G_PER_KG} g/kg）以下に抑えること`);
  }

  return { promptInjection: parts.join('\n'), mandatoryWarnings, contraindicatedTerms };
}

/**
 * The safety gate. Takes raw LLM output and returns a recommendation that is
 * guaranteed safe and explainable:
 *   1. contraindicated foods are removed (with a transparency note),
 *   2. caution foods are annotated with safetyNotes,
 *   3. adjustedMacros are clamped to condition caps,
 *   4. mandatory warnings are merged in (so they appear even if the LLM omits them).
 */
export function filterRecommendation(
  raw: Recommendation,
  profile: UserHealthProfile,
  weightKg: number | null,
): Recommendation {
  const safeFoods: RecommendedFood[] = [];
  const blockedMessages: string[] = [];

  for (const food of raw.foods ?? []) {
    const { allowed, notes } = screenFood(food.name, profile);
    if (!allowed) {
      const blocking = notes.find(n => n.severity === 'contraindicated');
      blockedMessages.push(
        `AIが提案した「${food.name}」は${blocking?.ref ?? '健康状態'}との禁忌のため推薦から除外しました`,
      );
      continue;
    }
    safeFoods.push(notes.length ? { ...food, safetyNotes: notes } : food);
  }

  let adjustedMacros = raw.adjustedMacros;
  let capsApplied: string[] = [];
  if (adjustedMacros) {
    const clamped = clampMacros(adjustedMacros, profile, weightKg);
    adjustedMacros = clamped.macros;
    capsApplied = clamped.capsApplied;
  }

  const report = buildSafetyReport(profile, weightKg);
  const warnings = [...new Set([
    ...report.mandatoryWarnings,
    ...blockedMessages,
    ...(raw.warnings ?? []),
  ])];

  return {
    ...raw,
    foods:            safeFoods,
    warnings,
    adjustedMacros,
    macroCapsApplied: capsApplied.length ? capsApplied : undefined,
  };
}
