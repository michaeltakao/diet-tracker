import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getServerUser } from '@/lib/supabase-server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { buildSafetyReport, filterRecommendation } from '@/lib/recommend-safety';
import type { UserHealthProfile, DailyGoals, Recommendation } from '@/lib/types';

const apiKey = process.env.GEMINI_API_KEY;

interface RecommendRequest {
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

const SYSTEM_PROMPT = `You are a personalized health coach AI built into a diet tracking app.
Given the user's health profile, today's nutrition intake, and recent logs, generate concrete recommendations.

Respond ONLY in JSON with this exact structure (no markdown, no code block):
{
  "foods": [
    {
      "name": "food name in Japanese",
      "reason": "one sentence, health-condition-aware",
      "calories": approximate_kcal_as_number,
      "macroHighlight": "short label e.g. 高タンパク・低脂質",
      "macroFit": "short label tying it to the remaining macro budget, e.g. 残りタンパク質を補える"
    }
  ],
  "exercises": [
    {
      "name": "exercise name in Japanese",
      "category": "strength or cardio or flexibility or other",
      "duration": "e.g. 30分",
      "reason": "one sentence tailored to fitness goal and activity level"
    }
  ],
  "warnings": ["condition-specific warnings, e.g. 高血圧の方は塩分に注意"],
  "adjustedMacros": {
    "calories": number,
    "protein": number,
    "fat": number,
    "carbs": number,
    "water": number
  }
}

Rules:
- SAFETY (highest priority): NEVER recommend any food listed under 禁忌 in the 【安全制約】 section, and never exceed any limit stated there. A deterministic safety filter will reject violations, so comply exactly.
- foods: 3-5 specific food recommendations covering the user's remaining macro budget
- exercises: 2-3 recommendations appropriate for their activity level and fitness goal
- warnings: only if health conditions require dietary caution; empty array [] if no relevant conditions
- adjustedMacros: only if current goals are clearly misaligned with the user's age/conditions/goal (e.g. 70-year-old with 150g protein target); null otherwise — return the literal null value, not an object
- All text must be in Japanese
- Return only raw JSON, no extra text`;

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit(user.id, 'recommend', RATE_LIMITS['recommend']);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before retrying.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetAfterMs / 1000)) } },
    );
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
  }

  try {
    const body = await request.json() as RecommendRequest;
    const { profile, goals, today } = body;
    const weightKg = body.weightKg ?? null;

    // Deterministic safety context: injected into the prompt (defense at source)
    // and re-applied to the LLM output below (defense-in-depth).
    const safety = buildSafetyReport(profile, weightKg);

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
${safety.promptInjection || '特記事項なし'}

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

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userMessage }] },
      ],
    });

    const raw = (response.text ?? '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Could not parse JSON from Gemini response', raw },
        { status: 500 },
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<Recommendation>;
    const rawRec: Recommendation = {
      foods:          parsed.foods          ?? [],
      exercises:      parsed.exercises       ?? [],
      warnings:       parsed.warnings        ?? [],
      adjustedMacros: parsed.adjustedMacros  ?? null,
      generatedAt:    new Date().toISOString(),
    };

    // Safety gate: remove contraindicated foods, clamp macros, guarantee warnings.
    const safeRec = filterRecommendation(rawRec, profile, weightKg);
    return NextResponse.json(safeRec);

  } catch (error) {
    console.error('[RECOMMEND_API_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Recommend failed: ${message}` }, { status: 500 });
  }
}
