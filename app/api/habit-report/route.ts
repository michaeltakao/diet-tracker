import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { guardAiRoute } from '@/lib/api-guard';
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
Analyze the user's 7-day behavioral data and return ONLY valid JSON (no markdown fences):
{
  "strengths": ["string", "string", "string"],
  "frictions": ["string", "string", "string"],
  "nextWeekTarget": "string (one specific, measurable action for next week)"
}
- strengths: 2-3 things the user did well (be specific with data points)
- frictions: 2-3 behavioral patterns to fix (reference specific days/times)
- nextWeekTarget: one clear, achievable goal with a concrete metric
Be warm, encouraging, and precise. Reference actual numbers from the data.`;

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await guardAiRoute(request);
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userMessage }] }],
    });

    const raw = (response.text ?? '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse JSON from Gemini', raw }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      strengths: string[];
      frictions: string[];
      nextWeekTarget: string;
    };

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Habit report API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Habit report failed: ${message}` }, { status: 500 });
  }
}
