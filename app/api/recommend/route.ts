import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_MODEL, generateWithRetry, jsonConfig, parseGeminiJson } from '@/lib/gemini';
import { guardAiRoute, recordAiUsage } from '@/lib/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { buildSafetyReport, filterRecommendation } from '@/lib/recommend-safety';
import { parseWeightKg } from '@/lib/medication-rules';
import { buildRecommendPrompt, RESPONSE_SCHEMA, type RecommendRequest } from '@/lib/recommend-prompt';
import type { Recommendation } from '@/lib/types';

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await guardAiRoute(request, 'recommend');
  if ('blocked' in guard) return guard.blocked;

  const rl = checkRateLimit(guard.clientId, 'recommend', RATE_LIMITS['recommend']);
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
    const body = await request.json() as RecommendRequest;
    const { profile } = body;
    // Validated: an absurd weight (1e9, Infinity) would lift the CKD protein cap.
    const weightKg = parseWeightKg(body.weightKg);

    // Deterministic safety context: injected into the prompt (defense at source)
    // and re-applied to the LLM output below (defense-in-depth).
    const safety = buildSafetyReport(profile, weightKg);

    const prompt = buildRecommendPrompt(body, safety.promptInjection);

    const ai = new GoogleGenAI({ apiKey });
    const response = await generateWithRetry(ai, {
      model: GEMINI_MODEL,
      config: jsonConfig(RESPONSE_SCHEMA),
      contents: [
        { role: 'user', parts: [{ text: prompt }] },
      ],
    });

    await recordAiUsage(guard.userId, 'recommend', response.usageMetadata?.totalTokenCount);

    const parsed = parseGeminiJson<Partial<Recommendation>>(response.text);
    const rawRec: Recommendation = {
      foods:          parsed.foods          ?? [],
      exercises:      parsed.exercises       ?? [],
      warnings:       parsed.warnings        ?? [],
      adjustedMacros: parsed.adjustedMacros  ?? null,
      generatedAt:    new Date().toISOString(),
    };

    // Safety gate: remove contraindicated foods, clamp macros, guarantee warnings.
    const safeRec = filterRecommendation(rawRec, profile, weightKg, body.goals.water);
    return NextResponse.json(safeRec);

  } catch (error) {
    // Generic message only — never echo raw model output or error internals.
    console.error('[RECOMMEND_API_ERROR]', error);
    return NextResponse.json({ error: 'Recommendation failed. Please try again.' }, { status: 500 });
  }
}
