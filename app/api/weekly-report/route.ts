import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getServerUser } from '@/lib/supabase-server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

const apiKey = process.env.GEMINI_API_KEY;

interface DailyNutrition {
  date:      string;
  calories:  number;
  protein:   number;
  fat:       number;
  carbs:     number;
  water:     number;
  mealCount: number;
}

interface WeeklyReportRequest {
  startDate:      string;
  endDate:        string;
  calorieGoal:    number;
  proteinGoal:    number;
  fatGoal:        number;
  carbsGoal:      number;
  waterGoal:      number;
  dailyNutrition: DailyNutrition[];
  workoutDays:    number;
  totalWorkouts:  number;
  weightStart:    number | null;
  weightEnd:      number | null;
  streak:         number;
}

const SYSTEM_PROMPT = `You are a supportive Japanese health coach. Based on 7-day nutrition and exercise data, write a concise weekly report.

Return ONLY valid JSON (no markdown, no code block):
{
  "summary": "2-3 sentences summarizing this week's overall performance with specific numbers",
  "highlight": "one specific achievement to celebrate this week",
  "improvement": "one concrete area to focus on next week",
  "nextWeekGoal": "one measurable, achievable goal with a specific metric"
}

Be warm, specific, and data-driven. Write entirely in Japanese.`;

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit(user.id, 'weekly-report', RATE_LIMITS['weekly-report']);
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
    const body = await request.json() as WeeklyReportRequest;

    const datadays = body.dailyNutrition.filter(d => d.mealCount > 0);
    if (datadays.length < 2) {
      return NextResponse.json({ error: 'insufficient_data' }, { status: 422 });
    }

    // Compute server-side stats
    const avgCalories = Math.round(datadays.reduce((s, d) => s + d.calories, 0) / datadays.length);
    const avgProtein  = Math.round(datadays.reduce((s, d) => s + d.protein,  0) / datadays.length * 10) / 10;
    const avgFat      = Math.round(datadays.reduce((s, d) => s + d.fat,      0) / datadays.length * 10) / 10;
    const avgCarbs    = Math.round(datadays.reduce((s, d) => s + d.carbs,    0) / datadays.length * 10) / 10;

    const calorieCompliantDays = datadays.filter(d =>
      d.calories >= body.calorieGoal - 200 && d.calories <= body.calorieGoal + 200
    ).length;
    const calorieCompliance = Math.round((calorieCompliantDays / datadays.length) * 100);
    const waterGoalDays     = body.dailyNutrition.filter(d => d.water >= body.waterGoal).length;

    // Week score (0–100)
    const calScore = Math.min(calorieCompliance, 100) * 0.30;
    const prtScore = Math.min((avgProtein / body.proteinGoal) * 100, 100) * 0.25;
    const wktScore = Math.min((body.workoutDays / 4) * 100, 100) * 0.25;
    const h2oScore = Math.min((waterGoalDays / datadays.length) * 100, 100) * 0.10;
    const stkScore = Math.min((body.streak / 7) * 100, 100) * 0.10;
    const weekScore = Math.round(calScore + prtScore + wktScore + h2oScore + stkScore);

    const weightChange = body.weightStart != null && body.weightEnd != null
      ? +(body.weightEnd - body.weightStart).toFixed(1)
      : null;

    const userMessage = `
【週次レポート対象期間】${body.startDate} ～ ${body.endDate}

■ 栄養摂取（データあり: ${datadays.length}/7日）
- 平均カロリー: ${avgCalories} kcal（目標: ${body.calorieGoal} kcal、目標達成率: ${calorieCompliance}%）
- 平均タンパク質: ${avgProtein}g（目標: ${body.proteinGoal}g）
- 平均脂質: ${avgFat}g（目標: ${body.fatGoal}g）
- 平均炭水化物: ${avgCarbs}g（目標: ${body.carbsGoal}g）
- 水分目標達成日: ${waterGoalDays}日

■ 日別カロリー
${body.dailyNutrition.map(d =>
  `${d.date}: ${d.mealCount > 0 ? `${d.calories}kcal (${d.mealCount}食)` : 'データなし'}`
).join('\n')}

■ トレーニング
- 実施日数: ${body.workoutDays}日 / 7日
- 総セッション数: ${body.totalWorkouts}回

■ 体重
${weightChange != null
  ? `${body.weightStart}kg → ${body.weightEnd}kg（${weightChange >= 0 ? '+' : ''}${weightChange}kg）`
  : '体重データなし'}

■ 記録継続
- 現在のストリーク: ${body.streak}日
- 週スコア: ${weekScore}/100
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
      summary:      string;
      highlight:    string;
      improvement:  string;
      nextWeekGoal: string;
    };

    return NextResponse.json({
      ...parsed,
      weekScore,
      avgCalories,
      avgProtein,
      calorieCompliance,
      workoutDays:  body.workoutDays,
      weightChange,
      generatedAt:  new Date().toISOString(),
    });

  } catch (error) {
    console.error('[WEEKLY_REPORT_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Weekly report failed: ${message}` }, { status: 500 });
  }
}
