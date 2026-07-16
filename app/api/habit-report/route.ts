import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { generateWithRetry, jsonConfig, parseGeminiJson } from '@/lib/gemini';
import { guardAiRoute, recordAiUsage } from '@/lib/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

const apiKey = process.env.GEMINI_API_KEY;

interface DaySummary {
  date: string;
  mealCount: number;
  totalCalories: number;
  earliestMealHour: number | null;
  latestMealHour: number | null;
  lateNightMeals: number; // after 21:00
  workoutCount: number;
  workoutHours: number[];
  missedPostWorkoutWindow: boolean; // no meal within 2h after last workout
}

interface HabitRequest {
  daysWithData: number;
  totalDays: number;
  avgDailyCalories: number;
  calorieGoal: number;
  lateNightEatingDays: number;
  noBreakfastDays: number;
  avgBreakfastHour: number | null;
  workoutDays: number;
  missedPostWorkoutDays: number;
  streak: number;
  dailySummary: DaySummary[];
}

const SYSTEM_PROMPT = `You are a compassionate Japanese chronobiological nutrition coach.
Analyze the user's 7-day behavioral data.
- strengths: 2-3 things the user did well (be specific with data points)
- frictions: 2-3 behavioral patterns to fix (reference specific days/times)
- nextWeekTarget: one clear, achievable goal with a concrete metric
Be warm, encouraging, and precise. Reference actual numbers from the data. Respond in Japanese.`;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    strengths:      { type: Type.ARRAY, items: { type: Type.STRING } },
    frictions:      { type: Type.ARRAY, items: { type: Type.STRING } },
    nextWeekTarget: { type: Type.STRING, description: 'one specific, measurable action for next week' },
  },
  required: ['strengths', 'frictions', 'nextWeekTarget'],
};

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await guardAiRoute(request, 'habit-report');
  if ('blocked' in guard) return guard.blocked;

  const rl = checkRateLimit(guard.clientId, 'habit-report', RATE_LIMITS['habit-report']);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before retrying.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.resetAfterMs / 1000)) },
      }
    );
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
  }

  try {
    const body = await request.json() as HabitRequest;

    if (body.daysWithData < 3) {
      return NextResponse.json({ error: 'insufficient_data' }, { status: 422 });
    }

    const userMessage = `
【7日間の習慣データ分析】

■ 概要
- データのある日: ${body.daysWithData} / ${body.totalDays} 日
- 平均カロリー摂取: ${Math.round(body.avgDailyCalories)} kcal / 目標 ${body.calorieGoal} kcal
- 連続記録: ${body.streak} 日
- トレーニング実施日: ${body.workoutDays} 日

■ 時間パターン
- 夜21時以降の食事あり: ${body.lateNightEatingDays} 日
- 朝食未記録日: ${body.noBreakfastDays} 日
- 朝食の平均時刻: ${body.avgBreakfastHour != null ? `${body.avgBreakfastHour}時台` : 'データなし'}
- 運動後の栄養補給を逃した日: ${body.missedPostWorkoutDays} 日

■ 日別サマリー
${body.dailySummary.map((d) => {
  const workouts = d.workoutHours.length > 0 ? `運動${d.workoutHours.map((h) => `${h}時`).join('/')}` : '運動なし';
  return `${d.date}: 食事${d.mealCount}回(${d.totalCalories}kcal) 最初${d.earliestMealHour != null ? d.earliestMealHour + '時' : '-'} 最後${d.latestMealHour != null ? d.latestMealHour + '時' : '-'} 夜間食事${d.lateNightMeals}回 ${workouts}`;
}).join('\n')}
    `.trim();

    const ai = new GoogleGenAI({ apiKey });
    const response = await generateWithRetry(ai, {
      model: 'gemini-2.5-flash',
      config: jsonConfig(RESPONSE_SCHEMA),
      contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userMessage }] }],
    });

    await recordAiUsage(guard.userId, 'habit-report', response.usageMetadata?.totalTokenCount);

    const parsed = parseGeminiJson<{
      strengths: string[];
      frictions: string[];
      nextWeekTarget: string;
    }>(response.text);

    return NextResponse.json(parsed);
  } catch (error) {
    // Generic message only — never echo raw model output or error internals.
    console.error('Habit report API error:', error);
    return NextResponse.json({ error: 'Habit report failed. Please try again.' }, { status: 500 });
  }
}
