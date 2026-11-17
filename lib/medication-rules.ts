/**
 * Static rules for medication-food interactions and condition-specific
 * workout/nutrition warnings.
 *
 * Sources: general pharmacology and clinical guidelines.
 * This is informational only — not a substitute for medical advice.
 */

// ── Condition-specific rules ────────────────────────────────────────────────

/**
 * CKD fluid policy (2026-11-17, "neutral: follow doctor"). Fluid restriction is
 * common in advanced CKD / dialysis and the app does not know the stage, so it
 * must never push water intake up OR down — only defer to the treating doctor.
 * Shown to users (workout + nutrition warnings) …
 */
export const CKD_FLUID_GUIDANCE =
  '水分量は主治医の指示に従ってください（腎臓病の病期によっては水分制限が必要です）';
/**
 * Conditions under which the app stays fluid-neutral (no water push, no water
 * scoring). Only CKD for now; 心臓病 (heart failure) is a known follow-up.
 */
export const FLUID_NEUTRAL_CONDITIONS: readonly string[] = ['腎臓病'];
export function isFluidNeutral(healthConditions: readonly string[]): boolean {
  return healthConditions.some(c => FLUID_NEUTRAL_CONDITIONS.includes(c));
}
/** … and injected into every AI prompt that carries the health context. */
export const CKD_FLUID_PROMPT =
  '■ 腎臓病のため、水分摂取を増やす・減らす提案はしないこと。水分に触れる場合は「主治医の指示に従う」とだけ述べること';

/**
 * CKD protein policy (2026-11-17). Single source for the renal protein cap —
 * used by recommend's clamp, every AI prompt that carries the health context,
 * and the weekly-report score. Conservative end of the 0.6–0.8 g/kg range.
 */
export const CKD_PROTEIN_G_PER_KG = 0.8;
export function isProteinCapped(healthConditions: readonly string[]): boolean {
  return healthConditions.includes('腎臓病');
}
/** Daily CKD protein cap in grams, or null when body weight is unknown. */
export function ckdProteinCapG(weightKg: number | null | undefined): number | null {
  return weightKg != null && weightKg > 0 ? Math.round(CKD_PROTEIN_G_PER_KG * weightKg) : null;
}
/** Prompt line for the CKD protein cap (weight-specific when known). */
export function ckdProteinPrompt(weightKg: number | null | undefined): string {
  const cap = ckdProteinCapG(weightKg);
  return cap != null
    ? `■ 腎臓病のためタンパク質は1日 ${cap}g（${CKD_PROTEIN_G_PER_KG} g/kg）以下に抑えること。ユーザーの目標値がこれより高くても上限を優先し、上限を超える摂取を勧めないこと`
    : `■ 腎臓病のためタンパク質は体重1kgあたり${CKD_PROTEIN_G_PER_KG}g以下に抑えること（具体量は主治医の指示に従う）。目標値より上限を優先すること`;
}
/** Validate a client-sent body weight: finite, 0 < w < 500 kg, else null. */
export function parseWeightKg(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) && x > 0 && x < 500 ? x : null;
}

export interface ConditionRule {
  condition: string;
  workoutWarnings: string[];
  nutritionWarnings: string[];
  proteinGuide?: string;
}

export const CONDITION_RULES: ConditionRule[] = [
  {
    condition: '糖尿病',
    workoutWarnings: [
      '運動前後に血糖値を測定してください',
      'インスリン使用中は運動後4〜8時間の遅発性低血糖に注意',
      '低血糖時の補食（ブドウ糖10g相当）を携帯してください',
    ],
    nutritionWarnings: [
      '食後血糖スパイクを抑えるため、野菜→タンパク質→炭水化物の食べ順を推奨',
      'SGLT-2阻害薬服用中は極端な糖質制限を避けてください（ケトアシドーシスリスク）',
    ],
  },
  {
    condition: '高血圧',
    workoutWarnings: [
      '高強度の等尺性運動（重量物の保持）は血圧を急上昇させます。RPE 6/10以下を目安に',
      '息を止めるValsalva法は禁止。挙上時に息を吐いてください',
      'β遮断薬服用中は心拍数が上がらないため、主観的運動強度（RPE）で強度を管理してください',
    ],
    nutritionWarnings: [
      '塩分は1日6g未満を目標に',
      '利尿薬服用中はカリウムが低下しやすいためバナナ・アボカド・ほうれん草を意識的に摂取',
    ],
  },
  {
    condition: '腎臓病',
    workoutWarnings: [
      '高強度運動後の横紋筋融解症（ミオグロビン尿）に注意。初期は低強度から開始',
      CKD_FLUID_GUIDANCE,
    ],
    nutritionWarnings: [
      'タンパク質摂取量を0.6〜0.8 g/kg/日以下に制限（CKD stage 3以上が目安）',
      'カリウム・リンの多い食品（果物・野菜・乳製品・ナッツ）は主治医の指示に従って制限',
      'プロテインサプリは必ず主治医に相談してから使用してください',
      CKD_FLUID_GUIDANCE,
    ],
    proteinGuide: '0.6〜0.8 g/kg/日',
  },
  {
    condition: '心臓病',
    workoutWarnings: [
      '運動前に安静時心拍数・血圧を確認してください',
      '胸痛・動悸・呼吸困難が出たら直ちに中断して安静に',
      '運動負荷試験の実施を主治医に相談してから運動プログラムを開始してください',
      '急激な強度変化を避け、ウォームアップ・クールダウンを必ず行ってください',
    ],
    nutritionWarnings: [
      '飽和脂肪酸・トランス脂肪酸を控え、オメガ3脂肪酸を意識的に摂取',
      '塩分制限（1日6g未満）を遵守してください',
    ],
  },
  {
    condition: '骨粗鬆症',
    workoutWarnings: [
      '転倒・衝撃リスクのある運動（急激な方向転換、高重量の頭上挙上）に注意',
      '荷重運動（スクワット・ウォーキング）は骨密度維持に有効',
      'ステロイド長期服用中は筋萎縮が起こりやすいため筋トレ継続が重要',
    ],
    nutritionWarnings: [
      'カルシウム（乳製品・小魚）とビタミンD（鮭・卵黄・日光）を意識的に摂取',
    ],
  },
  {
    condition: '甲状腺疾患',
    workoutWarnings: [
      '甲状腺機能低下症では回復が遅くなります。過度なオーバートレーニングに注意',
      '甲状腺機能亢進症で治療中の場合、TSH正常化後から高強度運動を開始してください',
    ],
    nutritionWarnings: [
      'ヨード過剰（昆布の過食）は甲状腺機能に影響します。日常量であれば問題ありません',
    ],
  },
  {
    condition: '高脂血症',
    workoutWarnings: [
      'スタチン服用中に筋肉痛・脱力感が強くなった場合は主治医に相談してください（ミオパチーの可能性）',
    ],
    nutritionWarnings: [
      '飽和脂肪酸（バター・ラード・肉の脂身）を控え、不飽和脂肪酸（オリーブ油・青魚）を選ぶ',
      'コレステロール摂取量より飽和脂肪酸の制限が重要です',
    ],
  },
  {
    condition: '痛風',
    workoutWarnings: [
      '発作中は安静にしてください。発作が落ち着いてから運動を再開',
      '脱水は尿酸値を上昇させます。運動中の水分補給を徹底',
    ],
    nutritionWarnings: [
      'プリン体の多い食品（レバー・イワシ・アジ・エビ・ビール）を制限',
      '水分を1日2,000mL以上摂取して尿酸排泄を促進',
      '果糖（清涼飲料水・果汁100%ジュース）も尿酸値を上げるため注意',
    ],
  },
  {
    condition: '貧血',
    workoutWarnings: [
      'めまい・動悸・息切れが出たら運動を中断してください',
      '鉄欠乏性貧血では持久系パフォーマンスが低下します。治療を優先してから強度を上げてください',
    ],
    nutritionWarnings: [
      'ヘム鉄（赤身肉・レバー・あさり）を積極的に摂取',
      '鉄の吸収にはビタミンC（ブロッコリー・パプリカ・柑橘）を一緒に',
      '緑茶・コーヒー・牛乳は鉄の吸収を阻害するため食事と時間をずらす',
    ],
  },
];

// ── Medication-specific rules ───────────────────────────────────────────────

export interface MedicationRule {
  keywords: string[];   // match by includes (case-insensitive)
  displayName: string;
  timingNote?: string;  // e.g. "食前30分、空腹時"
  foodInteractions: string[];
  exerciseNotes: string[];
}

export const MEDICATION_RULES: MedicationRule[] = [
  {
    keywords: ['ワーファリン', 'ワルファリン', 'warfarin'],
    displayName: 'ワーファリン（抗凝固薬）',
    foodInteractions: [
      '⚠️ 納豆・クロレラ・青汁は禁忌（大量のビタミンKが薬効を大幅に低下させます）',
      '⚠️ ブロッコリー・ほうれん草・小松菜などビタミンK含有食品は毎日一定量を維持してください（増減が危険）',
      'グレープフルーツは影響が少ないですが、大量摂取は避けてください',
    ],
    exerciseNotes: [
      '激しい接触スポーツ・転倒リスクの高い運動は出血リスクがあります',
    ],
  },
  {
    keywords: ['スタチン', 'atorvastatin', 'rosuvastatin', 'クレストール', 'リピトール', 'リバロ', 'メバロチン'],
    displayName: 'スタチン系（脂質異常症）',
    foodInteractions: [
      '⚠️ グレープフルーツ・グレープフルーツジュースは禁忌（薬物代謝を阻害し筋炎リスクが上昇）',
    ],
    exerciseNotes: [
      '筋肉痛・脱力・暗褐色尿（ミオパチー症状）が出たら直ちに主治医に連絡',
    ],
  },
  {
    keywords: ['メトホルミン', 'グルコファージ', 'メトグルコ'],
    displayName: 'メトホルミン（糖尿病）',
    timingNote: '食直後に服用（胃腸症状を軽減）',
    foodInteractions: [
      'アルコールは乳酸アシドーシスリスクを高めます。飲酒は控えめに',
    ],
    exerciseNotes: [
      '高強度運動時に乳酸が蓄積しやすくなります。段階的に強度を上げてください',
    ],
  },
  {
    keywords: ['インスリン', 'insulin', 'ノボラピッド', 'ランタス', 'ヒューマログ', 'レベミル'],
    displayName: 'インスリン',
    foodInteractions: [
      '炭水化物の量とタイミングを毎回一定にすると血糖管理がしやすくなります',
    ],
    exerciseNotes: [
      '運動前後に血糖測定必須。運動後4〜8時間の遅発性低血糖に注意',
      '注射部位を運動する筋肉から離してください（吸収速度が変わります）',
    ],
  },
  {
    keywords: ['レボチロキシン', 'チラーヂン', 'チロナミン'],
    displayName: 'レボチロキシン（甲状腺ホルモン）',
    timingNote: '起床直後・空腹時に服用。服用後1時間は食事・コーヒー・サプリを避ける',
    foodInteractions: [
      '⚠️ 服用後1時間以内にコーヒー・プロテイン・牛乳・大豆食品・カルシウムサプリを摂ると吸収が大幅に低下します',
      '食物繊維の多い食事は吸収を妨げる可能性があります（同時摂取を避けてください）',
    ],
    exerciseNotes: [],
  },
  {
    keywords: ['ACE阻害薬', 'ARB', 'カルシウム拮抗薬', 'アムロジピン', 'オルメサルタン', 'テルミサルタン', 'エナラプリル', 'リシノプリル'],
    displayName: '降圧薬（ACE阻害薬/ARB/Ca拮抗薬）',
    foodInteractions: [
      'ACE阻害薬・ARB服用中はカリウムサプリや塩化カリウム系代替塩の使いすぎに注意（高カリウム血症）',
      'グレープフルーツはCa拮抗薬（アムロジピン等）の血中濃度を上げます。避けてください',
    ],
    exerciseNotes: [
      '立ち上がり時のふらつき（起立性低血圧）に注意。急な体位変換を避けてください',
    ],
  },
  {
    keywords: ['利尿薬', 'フロセミド', 'スピロノラクトン', 'ヒドロクロロチアジド'],
    displayName: '利尿薬',
    foodInteractions: [
      'チアジド系・ループ利尿薬はカリウムを排泄します。バナナ・アボカド・ほうれん草でK補充を',
      'スピロノラクトンはカリウムを保持します。カリウム過多に注意',
    ],
    exerciseNotes: [
      '発汗による脱水・電解質異常が起こりやすいです。運動前後の水分・電解質補給を徹底',
    ],
  },
  {
    keywords: ['ビスホスホネート', 'アレンドロン', 'リセドロン', 'ボナロン', 'フォサマック', 'アクトネル'],
    displayName: 'ビスホスホネート（骨粗鬆症）',
    timingNote: '起床直後・空腹時に服用。服用後30分は食事・飲料（水以外）・横臥を避ける',
    foodInteractions: [
      '⚠️ カルシウム・牛乳・ジュースと一緒に飲むと吸収がほぼゼロになります',
    ],
    exerciseNotes: [],
  },
  {
    keywords: ['NSAIDs', 'ロキソニン', 'ボルタレン', 'セレコキシブ', 'イブプロフェン', 'アスピリン', 'ナプロキセン'],
    displayName: 'NSAIDs（消炎鎮痛薬）',
    timingNote: '食後に服用（胃腸障害を軽減）',
    foodInteractions: [
      'アルコールは胃腸障害・出血リスクを高めます',
    ],
    exerciseNotes: [
      '運動後の炎症反応・筋肉修復を抑制する可能性があります。筋トレ後の常用は避けてください',
    ],
  },
  {
    keywords: ['テトラサイクリン', 'ドキシサイクリン', 'ミノサイクリン'],
    displayName: 'テトラサイクリン系（抗生物質）',
    timingNote: '食間または食後（乳製品・カルシウムを含む食品の前後2時間は避ける）',
    foodInteractions: [
      '⚠️ 牛乳・ヨーグルト・カルシウムサプリ・鉄・マグネシウムと同時に飲むと吸収が激減します',
    ],
    exerciseNotes: [],
  },
];

// ── Helper functions ────────────────────────────────────────────────────────

/** Returns condition rules matching the user's health conditions. */
export function getConditionRules(healthConditions: string[]): ConditionRule[] {
  return CONDITION_RULES.filter(r => healthConditions.includes(r.condition));
}

/** Returns medication rules matching any of the user's medications. */
export function getMedicationRules(medications: string[]): MedicationRule[] {
  if (!medications.length) return [];
  return MEDICATION_RULES.filter(rule =>
    rule.keywords.some(kw =>
      medications.some(med =>
        med.toLowerCase().includes(kw.toLowerCase()) ||
        kw.toLowerCase().includes(med.toLowerCase()),
      ),
    ),
  );
}

/** All workout warnings for the user. */
export function getWorkoutWarnings(healthConditions: string[], medications: string[]): string[] {
  const condWarnings = getConditionRules(healthConditions).flatMap(r => r.workoutWarnings);
  const medWarnings  = getMedicationRules(medications).flatMap(r => r.exerciseNotes);
  return [...new Set([...condWarnings, ...medWarnings])];
}

/** All nutrition/food warnings for the user. */
export function getNutritionWarnings(healthConditions: string[], medications: string[]): string[] {
  const condWarnings = getConditionRules(healthConditions).flatMap(r => r.nutritionWarnings);
  const medWarnings  = getMedicationRules(medications).flatMap(r => r.foodInteractions);
  return [...new Set([...condWarnings, ...medWarnings])];
}

/** Format conditions + medications for AI prompt injection. */
export function buildHealthContextPrompt(
  healthConditions: string[],
  medications: string[],
  weightKg: number | null = null,
): string {
  if (!healthConditions.length && !medications.length) return '';
  const parts: string[] = [];
  if (healthConditions.length) {
    parts.push(`■ 持病: ${healthConditions.join('、')}`);
  }
  if (medications.length) {
    parts.push(`■ 服薬中: ${medications.join('、')}`);
    const rules = getMedicationRules(medications);
    rules.forEach(r => {
      if (r.foodInteractions.length) {
        parts.push(`  [${r.displayName}] 食事注意: ${r.foodInteractions.map(f => f.replace(/^⚠️ /, '')).join(' / ')}`);
      }
    });
  }
  // Every AI route (coach, weekly-report, suggest-workout, recommend) gets the
  // fluid instruction from here; listing the condition by name alone let the
  // model invent "drink more for kidney protection" (route smoke, 2026-11-17).
  if (isFluidNeutral(healthConditions)) parts.push(CKD_FLUID_PROMPT);
  // Same for protein: with only the condition name, coach and weekly-report
  // pushed CKD users toward their uncapped goal (99g→105g at a 58g cap).
  if (isProteinCapped(healthConditions)) parts.push(ckdProteinPrompt(weightKg));
  return parts.join('\n');
}
