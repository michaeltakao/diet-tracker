/**
 * Prompt construction for POST /api/recommend, kept apart from the route so
 * offline evaluation (scripts/gemini-safety-regression.ts) sends the exact
 * prompt that production sends.
 *
 * Pure: no I/O, no clock, no env. The safety context comes from
 * `buildSafetyReport` (lib/recommend-safety.ts); the caller passes it in so
 * the route can reuse the same report for its post-filter.
 */
import { Type, type Schema } from '@google/genai';
import type { UserHealthProfile, DailyGoals } from '@/lib/types';

export interface RecommendRequest {
  profile:          UserHealthProfile;
  goals:            DailyGoals;
  today:            string;
  todayCalories:    number;
  todayProtein:     number;
  todayFat:         number;
  todayCarbs:       number;
  waterConsumed:    number;
  recentFoodLog:    Array<{ date: string; name: string; calories: number; mealType: string }>;
  recentWorkoutLog: Array<{ date: string; name: string; category: string }>;
  streak:           number;
  weightKg?:        number | null;   // latest logged weight, for condition-based macro caps
}

const FITNESS_GOAL_LABELS: Record<string, string> = {
  weight_loss: '減量',
  muscle_gain: '筋肉増量',
  maintenance: '維持',
  endurance:   '持久力向上',
  flexibility: '柔軟性向上',
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary:         '座り仕事中心（ほぼ運動なし）',
  lightly_active:    '軽い運動（週1-2回）',
  moderately_active: '適度な運動（週3-5回）',
  very_active:       '活発な運動（週6-7回）',
  extra_active:      '超激しい運動・肉体労働',
};

export const SYSTEM_PROMPT = `You are a personalized health coach AI built into a diet tracking app.
Given the user's health profile, today's nutrition intake, and recent logs, generate concrete recommendations.

Rules:
- SAFETY (highest priority): NEVER recommend any food listed under 禁忌 in the 【安全制約】 section, and never exceed any limit stated there. A deterministic safety filter will reject violations, so comply exactly.
- foods: 3-5 specific food recommendations covering the user's remaining macro budget
- exercises: 2-3 recommendations appropriate for their activity level and fitness goal
- warnings: only if health conditions require dietary caution; empty array [] if no relevant conditions
- adjustedMacros: only if current goals are clearly misaligned with the user's age/conditions/goal (e.g. 70-year-old with 150g protein target); null otherwise
- All text must be in Japanese`;

export const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    foods: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name:           { type: Type.STRING, description: 'food name in Japanese' },
          reason:         { type: Type.STRING, description: 'one sentence, health-condition-aware' },
          calories:       { type: Type.NUMBER, description: 'approximate kcal' },
          macroHighlight: { type: Type.STRING, description: 'short label e.g. 高タンパク・低脂質' },
          macroFit:       { type: Type.STRING, description: 'short label tying it to the remaining macro budget, e.g. 残りタンパク質を補える' },
        },
        required: ['name', 'reason', 'calories', 'macroHighlight', 'macroFit'],
      },
    },
    exercises: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name:     { type: Type.STRING, description: 'exercise name in Japanese' },
          category: { type: Type.STRING, enum: ['strength', 'cardio', 'flexibility', 'other'] },
          duration: { type: Type.STRING, description: 'e.g. 30分' },
          reason:   { type: Type.STRING, description: 'one sentence tailored to fitness goal and activity level' },
        },
        required: ['name', 'category', 'duration', 'reason'],
      },
    },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING, description: 'condition-specific warning, e.g. 高血圧の方は塩分に注意' },
    },
    adjustedMacros: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        calories: { type: Type.NUMBER },
        protein:  { type: Type.NUMBER },
        fat:      { type: Type.NUMBER },
        carbs:    { type: Type.NUMBER },
        water:    { type: Type.NUMBER },
      },
      required: ['calories', 'protein', 'fat', 'carbs', 'water'],
    },
  },
  required: ['foods', 'exercises', 'warnings'],
};

/**
 * Build the full text sent to Gemini: system rules, a blank line, then the
 * user context block.
 *
 * Parameters
 * ----------
 * body : the request body as the client sent it
 * safetyPromptInjection : `buildSafetyReport(profile, weightKg).promptInjection`
 *
 * Returns
 * -------
 * The single prompt string (the route sends it as one user-role part).
 */
export function buildRecommendPrompt(body: RecommendRequest, safetyPromptInjection: string): string {
  const { profile, goals, today } = body;
  const weightKg = body.weightKg ?? null;

  const remainingCalories = goals.calories - body.todayCalories;
  const remainingProtein  = goals.protein  - body.todayProtein;
  const remainingFat      = goals.fat      - body.todayFat;
  const remainingCarbs    = goals.carbs    - body.todayCarbs;

  const userMessage = `
【ユーザープロフィール】
- 年齢: ${profile.age != null ? `${profile.age}歳` : '未設定'}
- 健康状態・疾患: ${profile.healthConditions.length > 0 ? profile.healthConditions.join('、') : 'なし'}
- 食事制限: ${profile.dietaryRestrictions.length > 0 ? profile.dietaryRestrictions.join('、') : 'なし'}
- フィットネス目標: ${FITNESS_GOAL_LABELS[profile.fitnessGoal] ?? profile.fitnessGoal}
- 活動レベル: ${ACTIVITY_LABELS[profile.activityLevel] ?? profile.activityLevel}
${weightKg != null ? `- 体重: ${weightKg}kg` : ''}

【安全制約（必ず遵守）】
${safetyPromptInjection || '特記事項なし'}

【今日の目標値】
- カロリー目標: ${goals.calories}kcal / タンパク質: ${goals.protein}g / 脂質: ${goals.fat}g / 炭水化物: ${goals.carbs}g / 水分: ${goals.water}ml

【今日の摂取状況 (${today})】
- 摂取済み: ${body.todayCalories}kcal（残り${remainingCalories}kcal）
- タンパク質: ${body.todayProtein}g（残り${remainingProtein}g）
- 脂質: ${body.todayFat}g（残り${remainingFat}g）
- 炭水化物: ${body.todayCarbs}g（残り${remainingCarbs}g）
- 水分: ${body.waterConsumed}ml / ${goals.water}ml
- 連続ログイン記録: ${body.streak}日

【直近の食事ログ（最新10件）】
${body.recentFoodLog.length > 0
? body.recentFoodLog.map(f => `- ${f.date} [${f.mealType}] ${f.name} (${f.calories}kcal)`).join('\n')
: 'データなし'}

【直近のワークアウト履歴】
${body.recentWorkoutLog.length > 0
? body.recentWorkoutLog.map(w => `- ${w.date} ${w.name} [${w.category}]`).join('\n')
: 'データなし'}
  `.trim();

  return SYSTEM_PROMPT + '\n\n' + userMessage;
}
