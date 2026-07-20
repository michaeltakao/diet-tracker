import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { generateWithRetry, jsonConfig, parseGeminiJson } from '@/lib/gemini';
import { createServerSupabase } from '@/lib/supabase-server';
import { guardAiRoute, recordAiUsage } from '@/lib/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { buildHealthContextPrompt } from '@/lib/medication-rules';

const apiKey = process.env.GEMINI_API_KEY;

// Client sends this regardless of auth state (check-in is always client-side)
interface SuggestRequest {
  today: string;
  checkIn: {
    mood:          number;
    energy:        number;
    sleepHours:    number;
    sorenessAreas: string[];
    notes?:        string;
  };
  // Used only in guest mode (no Supabase)
  plannedSession?: {
    name:      string;
    exercises: Array<{
      name: string; musclePart: string;
      sets: number; repsMin: number; repsMax: number;
      targetWeight?: number;
    }>;
  } | null;
  fitnessGoal?:      string;
  targetWeight?:     number | null;
  recentWorkouts?:   Array<{ date: string; name: string; musclePart?: string }>;
  personalRecords?:  Array<{ name: string; weight: number; date: string }>;
  healthConditions?: string[];
  medications?:      string[];
  // Training environment (phase B) — client-side prefs, validated below.
  environment?:      'home' | 'gym';
  equipment?:        string[];
}

const VALID_ENVIRONMENTS = ['home', 'gym'] as const;
const VALID_EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'] as const;
const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'バーベル', dumbbell: 'ダンベル', machine: 'マシン',
  cable: 'ケーブル', bodyweight: '自重のみ',
};

const SYSTEM_PROMPT = `You are an expert Japanese personal trainer and sports scientist inside a training app.
You will receive the user's daily check-in (mood, energy, sleep, soreness), today's planned training session,
their fitness goal, current vs target weight, recent workout history, and personal records.
Your job: analyze all this data and give a personalized training recommendation for today.

Health constraints (medical conditions/medications) MUST be respected — never recommend exercises or intensities that conflict with them.

Guidelines:
- mood ≥ 4 + energy ≥ 4 + sleep ≥ 7 → "full"
- energy ≤ 2 OR sleep ≤ 4 → "rest" or "reduced"
- soreness in a muscle group that overlaps today's session → adjust or swap exercises for that group
- Respect the user's fitnessGoal
- If no planned session: suggest an appropriate session from scratch based on goal + recent history
- When a training environment (自宅/ジム) or available-equipment list is given, ONLY suggest exercises
  feasible there — never machines or cables for a home user without them; prefer dumbbell/bodyweight
  alternatives and say what you substituted.
- Keep all text in Japanese. Be warm, specific, and actionable.`;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    proceed:           { type: Type.STRING, enum: ['full', 'reduced', 'alternative', 'rest'] },
    sessionName:       { type: Type.STRING, description: "today's recommended session name" },
    adjustments:       { type: Type.ARRAY, items: { type: Type.STRING } },
    intensityNote:     { type: Type.STRING },
    motivationMessage: { type: Type.STRING },
    recoveryTips:      { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['proceed', 'sessionName', 'adjustments', 'intensityNote', 'motivationMessage', 'recoveryTips'],
};

const MOOD_LABELS   = ['', '最悪', '悪い', '普通', '良い', '最高'];
const ENERGY_LABELS = ['', '完全消耗', '疲れ気味', '普通', '元気', '絶好調'];
const GOAL_LABELS: Record<string, string> = {
  weight_loss: '減量', muscle_gain: '筋肥大・増量',
  maintenance: '現状維持', endurance: '持久力向上', flexibility: '柔軟性向上',
};

export async function POST(request: Request): Promise<NextResponse> {
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

  const guard = await guardAiRoute(request, 'suggest-workout');
  if ('blocked' in guard) return guard.blocked;
  const userId = guard.userId;

  const rl = checkRateLimit(guard.clientId, 'suggest-workout', RATE_LIMITS['suggest-workout']);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before retrying.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetAfterMs / 1000)) } },
    );
  }

  let body: SuggestRequest;
  try {
    body = (await request.json()) as SuggestRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { today, checkIn } = body;
  if (!checkIn || typeof checkIn.mood !== 'number' || typeof checkIn.energy !== 'number') {
    return NextResponse.json({ error: 'Missing or invalid checkIn' }, { status: 400 });
  }
  const sorenessAreas = Array.isArray(checkIn.sorenessAreas) ? checkIn.sorenessAreas : [];
  // Environment prefs: unknown values are dropped, never echoed into the prompt.
  const environment = VALID_ENVIRONMENTS.includes(body.environment as 'home' | 'gym')
    ? body.environment
    : undefined;
  const equipment = Array.isArray(body.equipment)
    ? body.equipment.filter((e): e is string => VALID_EQUIPMENT.includes(e as typeof VALID_EQUIPMENT[number]))
    : [];

  try {

  // ── Data context ────────────────────────────────────────────────────────────

  let plannedSession   = body.plannedSession ?? null;
  let fitnessGoal      = body.fitnessGoal ?? 'maintenance';
  let targetWeight     = body.targetWeight ?? null;
  let currentWeight: number | null = null;
  let recentWorkouts   = body.recentWorkouts ?? [];
  let personalRecords  = body.personalRecords ?? [];
  let healthConditions = body.healthConditions ?? [];
  let medications      = body.medications ?? [];

  if (userId) {
    // ── Authenticated: fetch everything server-side from DB ──────────────────
    const supabase = await createServerSupabase();

    // Profile (goals, health, medications, fitness goal)
    const { data: profile } = await supabase
      .from('profiles')
      .select('fitness_goal, goal_weight_kg, health_conditions, medications')
      .eq('id', userId)
      .single();

    if (profile) {
      fitnessGoal      = (profile as { fitness_goal: string }).fitness_goal ?? 'maintenance';
      targetWeight     = (profile as { goal_weight_kg: number | null }).goal_weight_kg ?? null;
      healthConditions = (profile as { health_conditions: string[] }).health_conditions ?? [];
      medications      = (profile as { medications: string[] }).medications ?? [];
    }

    // Latest body weight
    const { data: latestWeight } = await supabase
      .from('weight_logs')
      .select('weight_kg')
      .eq('user_id', userId)
      .order('logged_date', { ascending: false })
      .limit(1)
      .single();
    if (latestWeight) currentWeight = (latestWeight as { weight_kg: number }).weight_kg;

    // Recent 14 days of workouts (more context than guest mode)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const startDate = fourteenDaysAgo.toISOString().split('T')[0];

    const { data: workouts } = await supabase
      .from('workout_logs')
      .select('logged_date, name, muscle_part')
      .eq('user_id', userId)
      .gte('logged_date', startDate)
      .order('logged_date', { ascending: false });

    if (workouts) {
      recentWorkouts = (workouts as Array<{ logged_date: string; name: string; muscle_part: string | null }>)
        .map(w => ({ date: w.logged_date, name: w.name, musclePart: w.muscle_part ?? undefined }));
    }

    // All personal records
    const { data: prs } = await supabase
      .from('personal_records')
      .select('exercise_name, max_weight_kg, achieved_date')
      .eq('user_id', userId)
      .order('max_weight_kg', { ascending: false })
      .limit(20);

    if (prs) {
      personalRecords = (prs as Array<{ exercise_name: string; max_weight_kg: number; achieved_date: string }>)
        .map(r => ({ name: r.exercise_name, weight: r.max_weight_kg, date: r.achieved_date }));
    }

    // Today's training program session from active program
    const { data: activeProgram } = await supabase
      .from('training_programs')
      .select('data')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (activeProgram && !plannedSession) {
      const prog = (activeProgram as { data: Record<string, unknown> }).data as {
        sessions: Array<{ id: string; name: string; exercises: Array<{ name: string; musclePart: string; sets: number; repsMin: number; repsMax: number; targetWeight?: number }> }>;
        weekSchedule: Record<string, string>;
      };
      const dow = new Date().getDay();
      const sessionId = prog.weekSchedule?.[dow];
      const session = sessionId ? prog.sessions?.find((s) => s.id === sessionId) : null;
      if (session) {
        plannedSession = {
          name: session.name,
          exercises: session.exercises.map(e => ({
            name: e.name, musclePart: e.musclePart,
            sets: e.sets, repsMin: e.repsMin, repsMax: e.repsMax,
            targetWeight: e.targetWeight,
          })),
        };
      }
    }
  }

  // ── Build prompt ────────────────────────────────────────────────────────────

  const healthCtx = buildHealthContextPrompt(healthConditions, medications);

  const userMessage = [
    `【今日の日付】${today}`,
    '',
    '【本日のチェックイン】',
    `・気分: ${MOOD_LABELS[checkIn.mood] ?? checkIn.mood} (${checkIn.mood}/5)`,
    `・体力: ${ENERGY_LABELS[checkIn.energy] ?? checkIn.energy} (${checkIn.energy}/5)`,
    `・睡眠: ${checkIn.sleepHours}時間`,
    `・筋肉痛: ${sorenessAreas.length > 0 ? sorenessAreas.join(', ') : 'なし'}`,
    checkIn.notes ? `・メモ: ${checkIn.notes}` : '',
    '',
    `【目標】${GOAL_LABELS[fitnessGoal] ?? fitnessGoal}`,
    targetWeight   != null ? `・目標体重: ${targetWeight} kg`  : '',
    currentWeight  != null ? `・現在体重: ${currentWeight} kg` : '',
    '',
    // Equipment restriction only makes sense for 'home' — a gym is assumed
    // fully equipped, so a stale localStorage equipment list from a prior
    // home session must not leak into a gym-environment suggestion.
    environment || (environment === 'home' && equipment.length > 0)
      ? [
          `【トレーニング環境】${environment === 'home' ? '自宅' : environment === 'gym' ? 'ジム' : '未設定'}`,
          environment === 'home' && equipment.length > 0
            ? `・使える器具: ${equipment.map((e) => EQUIPMENT_LABELS[e] ?? e).join('、')}（これ以外の器具は使えません）`
            : '',
        ].filter(Boolean).join('\n')
      : '',
    '',
    plannedSession
      ? [
          '【今日の予定セッション】',
          plannedSession.name,
          ...plannedSession.exercises.map(e =>
            `  - ${e.name} (${e.musclePart}): ${e.sets}セット × ${e.repsMin}–${e.repsMax}rep${e.targetWeight != null ? ` @ ${e.targetWeight}kg` : ''}`
          ),
        ].join('\n')
      : '【今日の予定セッション】なし（フリー提案）',
    '',
    '【直近のトレーニング履歴】',
    recentWorkouts.length > 0
      ? recentWorkouts.slice(0, 20).map(w => `  ${w.date} ${w.name}${w.musclePart ? ` (${w.musclePart})` : ''}`).join('\n')
      : '  記録なし',
    '',
    '【自己ベスト（PR）上位】',
    personalRecords.length > 0
      ? personalRecords.slice(0, 10).map(r => `  ${r.name}: ${r.weight}kg (${r.date})`).join('\n')
      : '  記録なし',
    healthCtx ? `\n${healthCtx}` : '',
    userId ? '\n【注意】このデータはサーバーサイドでデータベースから取得した正確な個人データです。' : '',
  ].filter(Boolean).join('\n');

  // ── Call Gemini ─────────────────────────────────────────────────────────────

  const ai = new GoogleGenAI({ apiKey });
  const result = await generateWithRetry(ai, {
    model: 'gemini-2.5-flash',
    // Merge into the existing config: systemInstruction/temperature survive.
    config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.7, ...jsonConfig(RESPONSE_SCHEMA) },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
  });

  await recordAiUsage(userId, 'suggest-workout', result.usageMetadata?.totalTokenCount);

  const suggestion = parseGeminiJson<Record<string, unknown>>(result.text);
  suggestion.generatedAt = new Date().toISOString();
  return NextResponse.json(suggestion);
  } catch (err) {
    // Generic message only — never echo raw model output or error internals.
    console.error('[SUGGEST_WORKOUT_ERROR]', err);
    return NextResponse.json({ error: 'Suggestion request failed. Please try again.' }, { status: 500 });
  }
}
