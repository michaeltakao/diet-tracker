import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { resolveClientId, accessGateBlocked } from '@/lib/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { buildHealthContextPrompt } from '@/lib/medication-rules';

const apiKey = process.env.GEMINI_API_KEY;

interface CoachRequest {
  today: string; // YYYY-MM-DD
  todayCalories: number;
  todayProtein: number;
  todayFat: number;
  todayCarbs: number;
  calorieGoal: number;
  proteinGoal: number;
  fatGoal: number;
  carbsGoal: number;
  waterConsumed: number;  // ml
  waterGoal: number;      // ml
  todayWorkouts: Array<{ name: string; weight: number; reps: number; sets: number }>;
  recentFoodLog: Array<{ date: string; time: string; name: string; calories: number; mealType: string }>;
  recentWorkoutLog: Array<{ date: string; name: string; weight: number }>;
  streak: number;
  healthConditions?: string[];
  medications?: string[];
}

const SYSTEM_PROMPT = `You are a friendly, encouraging Japanese personal health coach inside a diet tracking app.
The user will provide today's nutrition data, workout records, and recent history.
If the user has chronic conditions or takes medications, tailor your advice accordingly — reference specific constraints or interactions relevant to their situation.

Respond in Japanese. Structure your response as JSON with these fields:
{
  "todayAdvice": "string (2-3 sentences about today's nutrition & workouts, specific praise or correction)",
  "habitInsight": "string (1-2 sentences analyzing eating/workout time patterns — e.g. late-night snacking, skipping breakfast, workout timing vs meals)",
  "tomorrowTip": "string (1 actionable tip for tomorrow, condition-aware if applicable)",
  "motivationMessage": "string (short energetic motivational line)"
}

Be specific and personalized. Reference actual numbers from the data. Keep it warm, encouraging, and practical.
Do not include markdown code block formatting. Return only raw JSON.`;

export async function POST(request: Request): Promise<NextResponse> {
  const gate = accessGateBlocked(request);
  if (gate) return gate;

  const rl = checkRateLimit(await resolveClientId(request), 'coach', RATE_LIMITS['coach']);
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
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json() as CoachRequest;

    const healthCtx = buildHealthContextPrompt(
      body.healthConditions ?? [],
      body.medications ?? [],
    );

    const userMessage = `
${healthCtx ? `【ユーザーの健康状態】\n${healthCtx}\n\n` : ''}【今日の栄養データ (${body.today})】
- カロリー: ${body.todayCalories} / ${body.calorieGoal} kcal (${Math.round((body.todayCalories / body.calorieGoal) * 100)}%)
- タンパク質: ${body.todayProtein}g / ${body.proteinGoal}g
- 脂質: ${body.todayFat}g / ${body.fatGoal}g
- 炭水化物: ${body.todayCarbs}g / ${body.carbsGoal}g
- 水分: ${body.waterConsumed}ml / ${body.waterGoal}ml

【今日のトレーニング】
${body.todayWorkouts.length === 0
  ? 'なし'
  : body.todayWorkouts.map((w) => `- ${w.name}: ${w.weight}kg × ${w.reps}回 × ${w.sets}set`).join('\n')}

【最近の食事ログ (直近10件)】
${body.recentFoodLog.map((f) => `- ${f.date} ${f.time} [${f.mealType}] ${f.name} (${f.calories}kcal)`).join('\n')}

【最近のトレーニング履歴】
${body.recentWorkoutLog.length === 0
  ? 'なし'
  : body.recentWorkoutLog.map((w) => `- ${w.date} ${w.name} ${w.weight}kg`).join('\n')}

【継続記録】${body.streak}日連続
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
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      todayAdvice: string;
      habitInsight: string;
      tomorrowTip: string;
      motivationMessage: string;
    };

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Coach API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Coach failed: ${message}` }, { status: 500 });
  }
}
