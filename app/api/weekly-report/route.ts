import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { generateWithRetry } from '@/lib/gemini';
import { guardAiRoute } from '@/lib/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { buildHealthContextPrompt } from '@/lib/medication-rules';
import { runParallelAgents } from '@/lib/parallel-agents';

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
  weightStart:      number | null;
  weightEnd:        number | null;
  streak:           number;
  healthConditions?: string[];
  medications?:     string[];
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await guardAiRoute(request);
  if ('blocked' in guard) return guard.blocked;

  const rl = checkRateLimit(guard.clientId, 'weekly-report', RATE_LIMITS['weekly-report']);
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

    // Cap array length to prevent oversized prompts
    const nutrition7 = (Array.isArray(body.dailyNutrition) ? body.dailyNutrition : []).slice(0, 7);
    const datadays = nutrition7.filter(d => d.mealCount > 0);
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
    const waterGoalDays = datadays.filter(d => d.water >= body.waterGoal).length;

    // Week score (0–100)
    const safeProteinGoal = Math.max(body.proteinGoal, 1);
    const calScore = Math.min(calorieCompliance, 100) * 0.30;
    const prtScore = Math.min((avgProtein / safeProteinGoal) * 100, 100) * 0.25;
    const wktScore = Math.min((body.workoutDays / 4) * 100, 100) * 0.25;
    const h2oScore = Math.min((waterGoalDays / datadays.length) * 100, 100) * 0.10;
    const stkScore = Math.min((body.streak / 7) * 100, 100) * 0.10;
    const weekScore = Math.round(calScore + prtScore + wktScore + h2oScore + stkScore);

    const weightChange = body.weightStart != null && body.weightEnd != null
      ? +(body.weightEnd - body.weightStart).toFixed(1)
      : null;

    const healthCtx = buildHealthContextPrompt(
      body.healthConditions ?? [],
      body.medications ?? [],
    );

    const healthSection = healthCtx ? `【ユーザーの健康状態】\n${healthCtx}\n\n` : '';
    const periodLine = `【対象期間】${body.startDate} ～ ${body.endDate}`;
    const nutritionSection = `■ 栄養摂取（データあり: ${datadays.length}/7日）
- 平均カロリー: ${avgCalories} kcal（目標: ${body.calorieGoal} kcal、達成率: ${calorieCompliance}%）
- 平均タンパク質: ${avgProtein}g（目標: ${body.proteinGoal}g）
- 平均脂質: ${avgFat}g（目標: ${body.fatGoal}g）
- 平均炭水化物: ${avgCarbs}g（目標: ${body.carbsGoal}g）
- 水分目標達成日: ${waterGoalDays}/${datadays.length}日
■ 日別カロリー
${nutrition7.map(d =>
  `${d.date}: ${d.mealCount > 0 ? `${d.calories}kcal (${d.mealCount}食)` : 'データなし'}`
).join('\n')}`;
    const workoutSection = `■ トレーニング
- 実施日数: ${body.workoutDays}日 / 7日
- 総セッション数: ${body.totalWorkouts}回`;
    const weightSection = `■ 体重
${weightChange != null
  ? `${body.weightStart}kg → ${body.weightEnd}kg（${weightChange >= 0 ? '+' : ''}${weightChange}kg）`
  : '体重データなし'}`;
    const streakSection = `■ 継続記録: ${body.streak}日ストリーク、週スコア ${weekScore}/100`;

    const sharedContext = [healthSection, periodLine, nutritionSection, workoutSection, weightSection, streakSection]
      .filter(Boolean).join('\n\n');

    // Run 4 specialized agents in parallel
    const agentResults = await runParallelAgents(apiKey, [
      {
        id: 'nutrition',
        systemPrompt: '日本語でのみ回答してください。あなたは栄養専門家です。以下のデータに基づき、今週の栄養摂取について2〜3文で具体的な数値を使って分析してください。マクロバランス、カロリー達成率、水分摂取に着目してください。分析のみを返してください。',
        userMessage: sharedContext,
      },
      {
        id: 'workout',
        systemPrompt: '日本語でのみ回答してください。あなたはトレーニング専門家です。以下のデータに基づき、今週の運動について2〜3文で具体的に分析してください。頻度、一貫性、体重変化との関係に着目してください。分析のみを返してください。',
        userMessage: sharedContext,
      },
      {
        id: 'behavior',
        systemPrompt: '日本語でのみ回答してください。あなたは行動変容の専門家です。以下のデータに基づき、今週の習慣と継続性について2〜3文で分析してください。ストリーク、記録の一貫性、改善できる行動パターンに着目してください。分析のみを返してください。',
        userMessage: sharedContext,
      },
      {
        id: 'goal',
        systemPrompt: '日本語でのみ回答してください。あなたは目標設定の専門家です。以下のデータに基づき、来週取り組むべき具体的で達成可能な目標を1つ、数値を含めて提案してください。目標のみを返してください。',
        userMessage: sharedContext,
      },
    ]);

    const resultMap = Object.fromEntries(agentResults.map(r => [r.id, r.text]));

    // Orchestrator: combine specialist outputs into final JSON
    const ai = new GoogleGenAI({ apiKey });
    const orchestratorPrompt = `あなたは日本語の健康コーチです。以下の4人の専門家分析を統合して、週次レポートをJSON形式で作成してください。

【栄養専門家の分析】
${resultMap['nutrition'] ?? '（分析なし）'}

【トレーニング専門家の分析】
${resultMap['workout'] ?? '（分析なし）'}

【行動変容専門家の分析】
${resultMap['behavior'] ?? '（分析なし）'}

【目標設定専門家の提案】
${resultMap['goal'] ?? '（提案なし）'}

【週スコア】${weekScore}/100

以下のJSONのみを返してください（マークダウン不可）:
{
  "summary": "今週全体のパフォーマンスを具体的な数値を使って2〜3文でまとめた総評",
  "highlight": "今週の最も称えるべき1つの成果",
  "improvement": "来週に向けて改善すべき具体的な1点",
  "nextWeekGoal": "数値目標を含む、達成可能な来週の目標"
}`;

    const orchestratorResponse = await generateWithRetry(ai, {
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: orchestratorPrompt }] }],
    });

    const raw = (orchestratorResponse.text ?? '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse JSON from orchestrator', raw }, { status: 500 });
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
