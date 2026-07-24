import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { generateWithRetry, jsonConfig, parseGeminiJson } from '@/lib/gemini';
import { guardAiRoute, recordAiUsage } from '@/lib/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import {
  selectExercises,
  type GeneratePlanInput,
  type FitnessGoal,
  type TimeAvailableMin,
  type GeneratedPlan,
} from '@/lib/workout-generator';
import type { Equipment } from '@/lib/exercise-db';
import type { MusclePart } from '@/lib/types';

const apiKey = process.env.GEMINI_API_KEY;

const VALID_GOALS = ['hypertrophy', 'strength', 'endurance', 'weight_loss'] as const;
const VALID_EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'] as const;
const VALID_DURATIONS = [15, 30, 45, 60] as const;
const VALID_BODY_PARTS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs'] as const;

interface GenerateWorkoutRequest {
  goal?: string;
  availableEquipment?: string[];
  timeAvailableMin?: number;
  targetBodyParts?: string[];
}

/**
 * Narration-only response schema — deliberately has NO exercise list, sets,
 * reps, or rest fields. This is a structural safety property, not just a
 * convention: because Gemini's structured output is constrained to this
 * schema, the model has no field through which it could smuggle a different
 * exercise selection into the response even if the prompt were adversarially
 * crafted. The deterministic plan from {@link selectExercises} is the only
 * source of exercises/sets/reps in the final response (see the route body,
 * which merges `plan` in from the server, not from Gemini's output).
 */
export const NARRATION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    sessionName:       { type: Type.STRING, description: 'A short, motivating name for this session' },
    notes:              { type: Type.STRING, description: 'Ordering rationale / warmup note' },
    motivationMessage: { type: Type.STRING },
  },
  required: ['sessionName', 'notes', 'motivationMessage'],
};

const SYSTEM_PROMPT = `You are an expert Japanese personal trainer inside a training app.
You will receive an ALREADY-DECIDED workout plan (exercises, sets, reps, rest — chosen by a
deterministic engine, not you) plus the user's goal, equipment, and time budget.
Your job is ONLY to narrate this plan: give it a short motivating session name, a one- or
two-sentence note about exercise ordering or a warmup tip, and a brief motivational message.
Do NOT propose different exercises, sets, or reps — you have no ability to change them and any
such text will be ignored. Keep all text in Japanese. Be warm, specific, and concise.`;

const GOAL_LABELS: Record<FitnessGoal, string> = {
  hypertrophy: '筋肥大', strength: '筋力向上', endurance: '持久力向上', weight_loss: '減量',
};
const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'バーベル', dumbbell: 'ダンベル', machine: 'マシン', cable: 'ケーブル', bodyweight: '自重のみ',
};
const BODY_PART_LABELS: Record<string, string> = {
  chest: '胸', back: '背中', legs: '脚', shoulders: '肩', arms: '腕', abs: '腹筋',
};

function buildPrompt(input: GeneratePlanInput, plan: GeneratedPlan): string {
  return [
    `【目標】${GOAL_LABELS[input.goal]}`,
    `【利用可能な器具】${input.availableEquipment.length > 0 ? input.availableEquipment.map((e) => EQUIPMENT_LABELS[e] ?? e).join('、') : '自重のみ'}`,
    `【利用可能時間】${input.timeAvailableMin}分`,
    input.targetBodyParts && input.targetBodyParts.length > 0
      ? `【重点部位】${input.targetBodyParts.map((p) => BODY_PART_LABELS[p] ?? p).join('、')}`
      : '',
    '',
    '【決定済みプラン（変更不可）】',
    plan.exercises.length > 0
      ? plan.exercises.map((g) =>
          `  - ${g.exercise.nameJa} (${g.exercise.musclePart}): ${g.sets}セット × ${g.reps}rep, 休憩${g.restSec}秒`
        ).join('\n')
      : '  （条件に合う種目がありませんでした）',
    `  推定所要時間: 約${plan.estimatedDurationMin}分`,
  ].filter(Boolean).join('\n');
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

  const guard = await guardAiRoute(request, 'generate-workout');
  if ('blocked' in guard) return guard.blocked;
  const userId = guard.userId;

  const rl = checkRateLimit(guard.clientId, 'generate-workout', RATE_LIMITS['generate-workout']);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before retrying.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetAfterMs / 1000)) } },
    );
  }

  let body: GenerateWorkoutRequest;
  try {
    body = (await request.json()) as GenerateWorkoutRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!VALID_GOALS.includes(body.goal as typeof VALID_GOALS[number])) {
    return NextResponse.json({ error: 'Missing or invalid goal' }, { status: 400 });
  }
  const goal = body.goal as FitnessGoal;

  if (!VALID_DURATIONS.includes(body.timeAvailableMin as typeof VALID_DURATIONS[number])) {
    return NextResponse.json({ error: 'Missing or invalid timeAvailableMin' }, { status: 400 });
  }
  const timeAvailableMin = body.timeAvailableMin as TimeAvailableMin;

  const availableEquipment = Array.isArray(body.availableEquipment)
    ? body.availableEquipment.filter((e): e is Equipment => VALID_EQUIPMENT.includes(e as typeof VALID_EQUIPMENT[number]))
    : [];

  const targetBodyParts = Array.isArray(body.targetBodyParts)
    ? body.targetBodyParts.filter((p): p is MusclePart => VALID_BODY_PARTS.includes(p as typeof VALID_BODY_PARTS[number]))
    : undefined;

  const input: GeneratePlanInput = { goal, availableEquipment, timeAvailableMin, targetBodyParts };

  // ── Deterministic selection first — no AI cost if the plan is empty. ──────
  const plan = selectExercises(input);
  if (plan.exercises.length === 0) {
    return NextResponse.json({
      plan,
      narrative: {
        sessionName: '該当する種目がありません',
        notes: '選択した器具・部位の組み合わせに合う種目が見つかりませんでした。器具や部位の条件を変えてお試しください。',
        motivationMessage: '',
      },
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await generateWithRetry(ai, {
      model: 'gemini-2.5-flash',
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.7, ...jsonConfig(NARRATION_SCHEMA) },
      contents: [{ role: 'user', parts: [{ text: buildPrompt(input, plan) }] }],
    });

    await recordAiUsage(userId, 'generate-workout', result.usageMetadata?.totalTokenCount);

    const narrative = parseGeminiJson<{ sessionName: string; notes: string; motivationMessage: string }>(result.text);
    return NextResponse.json({ plan, narrative });
  } catch (err) {
    // Generic message only — never echo raw model output or error internals.
    console.error('[GENERATE_WORKOUT_ERROR]', err);
    return NextResponse.json({ error: 'Plan generation failed. Please try again.' }, { status: 500 });
  }
}
