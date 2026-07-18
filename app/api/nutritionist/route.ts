import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { generateWithRetry, jsonConfig, parseGeminiJson } from '@/lib/gemini';
import { guardAiRoute, recordAiUsage } from '@/lib/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * AI nutritionist: exactly 3 concrete improvement suggestions for TODAY's
 * already-logged meals (swaps, portions, additions to an existing meal).
 * Scope guard: this route improves what the user actually ate; suggesting
 * new foods to eat is /api/recommend's job — the prompt forbids overlap.
 */

const apiKey = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `You are a Japanese registered dietitian (管理栄養士) reviewing what a user actually ate today.
Given today's logged meals and the user's daily goals, give EXACTLY 3 concrete, actionable suggestions to improve TODAY's actual meals.

Rules:
- Base every suggestion on a specific logged item or the day's actual totals (name the item).
- Suggest swaps, portion changes, preparation changes, or small additions to existing meals — do NOT recommend brand-new meals or foods unrelated to what was logged.
- When sodium (食塩相当量) or fiber (食物繊維) data is present, you may use it; never guess values that are not provided.
- Non-diagnostic: no medical claims, no disease talk. Lifestyle guidance only.
- title: ≤ 20 characters. detail: 1–2 sentences, specific and warm.
- All text in Japanese.`;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    suggestions: {
      type: Type.ARRAY,
      description: 'exactly 3 items',
      items: {
        type: Type.OBJECT,
        properties: {
          title:  { type: Type.STRING, description: 'short heading in Japanese' },
          detail: { type: Type.STRING, description: '1–2 sentences in Japanese' },
        },
        required: ['title', 'detail'],
      },
    },
  },
  required: ['suggestions'],
};

interface EntryIn {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  sodiumMg?: number;
  fiberG?: number;
}

interface GoalsIn {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

const MAX_ENTRIES = 60;
const MAX_NAME_LEN = 80;
const MAX_VALUE = 99_999;

function numOk(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_VALUE;
}

/** Validate + sanitize the client payload; null on any shape violation. */
function parseBody(body: unknown): { entries: EntryIn[]; goals: GoalsIn } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { entries, goals } = body as { entries?: unknown; goals?: unknown };
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_ENTRIES) return null;
  if (typeof goals !== 'object' || goals === null) return null;

  const g = goals as Record<string, unknown>;
  if (!numOk(g.calories) || !numOk(g.protein) || !numOk(g.fat) || !numOk(g.carbs)) return null;

  const clean: EntryIn[] = [];
  for (const raw of entries) {
    if (typeof raw !== 'object' || raw === null) return null;
    const e = raw as Record<string, unknown>;
    if (typeof e.name !== 'string' || e.name.trim() === '') return null;
    if (!numOk(e.calories) || !numOk(e.protein) || !numOk(e.fat) || !numOk(e.carbs)) return null;
    clean.push({
      name: e.name.trim().slice(0, MAX_NAME_LEN),
      calories: e.calories,
      protein: e.protein,
      fat: e.fat,
      carbs: e.carbs,
      ...(numOk(e.sodiumMg) ? { sodiumMg: e.sodiumMg } : {}),
      ...(numOk(e.fiberG) ? { fiberG: e.fiberG } : {}),
    });
  }
  return {
    entries: clean,
    goals: { calories: g.calories, protein: g.protein, fat: g.fat, carbs: g.carbs },
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await guardAiRoute(request, 'nutritionist');
  if ('blocked' in guard) return guard.blocked;

  const rl = checkRateLimit(guard.clientId, 'nutritionist', RATE_LIMITS['nutritionist']);
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
      { error: 'GEMINI_API_KEY is not configured in environment variables.' },
      { status: 500 }
    );
  }

  let parsedBody: { entries: EntryIn[]; goals: GoalsIn } | null;
  try {
    parsedBody = parseBody(await request.json());
  } catch {
    parsedBody = null;
  }
  if (!parsedBody) {
    return NextResponse.json(
      { error: 'Invalid request body: expected non-empty entries[] and goals.' },
      { status: 400 }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const userPrompt = JSON.stringify({
      todayMeals: parsedBody.entries,
      dailyGoals: parsedBody.goals,
    });

    const response = await generateWithRetry(ai, {
      model: 'gemini-2.5-flash',
      config: { ...jsonConfig(RESPONSE_SCHEMA), systemInstruction: SYSTEM_PROMPT },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    });

    const parsed = parseGeminiJson<{ suggestions: Array<{ title: string; detail: string }> }>(
      response.text
    );
    const suggestions = (parsed.suggestions ?? [])
      .filter((s) => typeof s?.title === 'string' && typeof s?.detail === 'string')
      .slice(0, 3);
    if (suggestions.length !== 3) {
      // Contract is exactly 3 — anything else is a model failure, not the user's.
      throw new Error(`nutritionist: expected 3 suggestions, got ${suggestions.length}`);
    }

    await recordAiUsage(guard.userId, 'nutritionist', response.usageMetadata?.totalTokenCount);
    return NextResponse.json({ suggestions });
  } catch (error) {
    // Generic message only — never echo raw model output or error internals.
    console.error('Error generating nutritionist suggestions:', error);
    return NextResponse.json(
      { error: 'Suggestion generation failed. Please try again.' },
      { status: 500 }
    );
  }
}
