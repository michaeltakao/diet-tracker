import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { generateWithRetry } from '@/lib/gemini';
import { getServerUser, createServerSupabase } from '@/lib/supabase-server';
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
}

const SYSTEM_PROMPT = `You are an expert Japanese personal trainer and sports scientist inside a training app.
You will receive the user's daily check-in (mood, energy, sleep, soreness), today's planned training session,
their fitness goal, current vs target weight, recent workout history, and personal records.
Your job: analyze all this data and give a personalized training recommendation for today.

Health constraints (medical conditions/medications) MUST be respected — never recommend exercises or intensities that conflict with them.

Return ONLY raw JSON (no markdown) with this exact shape:
{
  "proceed": "full" | "reduced" | "alternative" | "rest",
  "sessionName": "string — today's recommended session name",
  "adjustments": ["string", ...],
  "intensityNote": "string",
  "motivationMessage": "string",
  "recoveryTips": ["string", ...]
}

Guidelines:
- mood ≥ 4 + energy ≥ 4 + sleep ≥ 7 → "full"
- energy ≤ 2 OR sleep ≤ 4 → "rest" or "reduced"
- soreness in a muscle group that overlaps today's session → adjust or swap exercises for that group
- Respect the user's fitnessGoal
- If no planned session: suggest an appropriate session from scratch based on goal + recent history
- Keep all text in Japanese. Be warm, specific, and actionable.`;

const MOOD_LABELS   = ['', '最悪', '悪い', '普通', '良い', '最高'];
const ENERGY_LABELS = ['', '完全消耗', '疲れ気味', '普通', '元気', '絶好調'];
const GOAL_LABELS: Record<string, string> = {
  weight_loss: '減量', muscle_gain: '筋肥大・増量',
  maintenance: '現状維持', endurance: '持久力向上', flexibility: '柔軟性向上',
};

export async function POST(request: Request): Promise<NextResponse> {
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

  const user = await getServerUser();
  // Guest access is intentional here (check-in is client-side). Prefer the
  // proxy-set x-real-ip; the x-forwarded-for chain's first entry is client-spoofable.
  const rateLimitId = user?.id
    ?? request.headers.get('x-real-ip')?.trim()
    ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? 'guest';

  const rl = checkRateLimit(rateLimitId, 'suggest-workout', RATE_LIMITS['suggest-workout']);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

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

  if (user) {
    // ── Authenticated: fetch everything server-side from DB ──────────────────
    const supabase = await createServerSupabase();

    // Profile (goals, health, medications, fitness goal)
    const { data: profile } = await supabase
      .from('profiles')
      .select('fitness_goal, goal_weight_kg, health_conditions, medications')
      .eq('id', user.id)
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
      .eq('user_id', user.id)
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
      .eq('user_id', user.id)
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
      .eq('user_id', user.id)
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
      .eq('user_id', user.id)
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
    user ? '\n【注意】このデータはサーバーサイドでデータベースから取得した正確な個人データです。' : '',
  ].filter(Boolean).join('\n');

  // ── Call Gemini ─────────────────────────────────────────────────────────────

  const ai = new GoogleGenAI({ apiKey });
  const result = await generateWithRetry(ai, {
    model: 'gemini-2.5-flash',
    config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.7 },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
  });

  const raw = result.text?.trim() ?? '';
  const jsonStr = raw.startsWith('{') ? raw : raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

    try {
      const suggestion = JSON.parse(jsonStr);
      suggestion.generatedAt = new Date().toISOString();
      return NextResponse.json(suggestion);
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response', raw }, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Suggestion request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
