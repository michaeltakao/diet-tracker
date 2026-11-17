import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { GEMINI_MODEL, generateWithRetry, jsonConfig, parseGeminiJson } from '@/lib/gemini';
import { guardAiRoute, recordAiUsage } from '@/lib/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { buildHealthContextPrompt, capGoalsForConditions } from '@/lib/medication-rules';
import { parseBody, type ParsedBody } from '@/lib/nutritionist-request';
import { screenSuggestions } from '@/lib/recommend-safety';
import type { UserHealthProfile } from '@/lib/types';

/**
 * AI nutritionist: exactly 3 concrete improvement suggestions for TODAY's
 * already-logged meals (swaps, portions, additions to an existing meal).
 * Scope guard: this route improves what the user actually ate; suggesting
 * new foods to eat is /api/recommend's job — the prompt forbids overlap.
 *
 * Safety (2026-11-17): optional health context (conditions, medications,
 * weight) is prepended to the prompt — including the CKD protein cap — and
 * every suggestion is re-screened deterministically (`screenSuggestions`);
 * a contraindicated hit is replaced by a fixed placeholder.
 */

const apiKey = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `You are a Japanese registered dietitian (管理栄養士) reviewing what a user actually ate today.
Given today's logged meals and the user's daily goals, give EXACTLY 3 concrete, actionable suggestions to improve TODAY's actual meals.

Rules:
- Base every suggestion on a specific logged item or the day's actual totals (name the item).
- Suggest swaps, portion changes, preparation changes, or small additions to existing meals — do NOT recommend brand-new meals or foods unrelated to what was logged.
- When sodium (食塩相当量) or fiber (食物繊維) data is present, you may use it; never guess values that are not provided.
- Non-diagnostic: no medical claims, no diagnosis. Lifestyle guidance only.
- If 【ユーザーの健康状態】 is given, its rules override the daily goals: never suggest foods it warns against, never suggest raising intake above any limit it states (e.g. a protein cap), and never suggest changing water intake when it says so.
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

  let parsedBody: ParsedBody | null;
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
    const { healthConditions, medications, weightKg } = parsedBody;
    const healthCtx = buildHealthContextPrompt(healthConditions, medications, weightKg);
    // Server-side cap too (defense in depth): an old cached bundle or a direct
    // caller may send an uncapped goal next to the CKD context.
    const goals = capGoalsForConditions(parsedBody.goals, healthConditions, weightKg);
    const payload = JSON.stringify({
      todayMeals: parsedBody.entries,
      dailyGoals: goals,
    });
    const userPrompt = healthCtx ? `【ユーザーの健康状態】\n${healthCtx}\n\n${payload}` : payload;

    const response = await generateWithRetry(ai, {
      model: GEMINI_MODEL,
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

    // Deterministic post-filter: the prompt asks the model to avoid
    // contraindicated foods; this guarantees no contraindicated food name
    // reaches the user. It does NOT catch caution-level advice (e.g. "add a
    // protein shake" for CKD) — that still rests on the prompt's cap line. Only the fields screenFood
    // reads are needed, so the profile is built from the request.
    const profile: UserHealthProfile = {
      age: null,
      healthConditions,
      dietaryRestrictions: [],
      medications,
      fitnessGoal: 'maintenance',
      activityLevel: 'moderately_active',
    };
    const screened = screenSuggestions(suggestions, profile);
    if (screened.blockedRefs.length > 0) {
      // Refs only (rule names), never the model text.
      console.warn('[NUTRITIONIST_BLOCKED]', screened.blockedRefs.join(','));
    }

    await recordAiUsage(guard.userId, 'nutritionist', response.usageMetadata?.totalTokenCount);
    return NextResponse.json({ suggestions: screened.suggestions });
  } catch (error) {
    // Generic message only — never echo raw model output or error internals.
    console.error('Error generating nutritionist suggestions:', error);
    return NextResponse.json(
      { error: 'Suggestion generation failed. Please try again.' },
      { status: 500 }
    );
  }
}
