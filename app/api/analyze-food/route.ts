import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { generateWithRetry, jsonConfig, parseGeminiJson } from '@/lib/gemini';
import { guardAiRoute, recordAiUsage } from '@/lib/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

const apiKey = process.env.GEMINI_API_KEY;

const PROMPT = `Analyze the food in this image and estimate its nutritional content.
Assume a typical single serving. Be realistic and conservative with estimates.
Put a brief note about the estimate in "notes".`;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name:       { type: Type.STRING, description: 'food name in English or Japanese' },
    calories:   { type: Type.NUMBER },
    protein:    { type: Type.NUMBER, description: 'grams' },
    fat:        { type: Type.NUMBER, description: 'grams' },
    carbs:      { type: Type.NUMBER, description: 'grams' },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
    notes:      { type: Type.STRING },
  },
  required: ['name', 'calories', 'protein', 'fat', 'carbs', 'confidence', 'notes'],
};

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await guardAiRoute(request, 'analyze-food');
  if ('blocked' in guard) return guard.blocked;

  const rl = checkRateLimit(guard.clientId, 'analyze-food', RATE_LIMITS['analyze-food']);
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

  try {
    const { imageBase64, mimeType } = await request.json() as {
      imageBase64: string;
      mimeType: string;
    };

    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { error: 'Missing imageBase64 or mimeType in request body.' },
        { status: 400 }
      );
    }

    // 4MB base64 ≈ 3MB decoded — Gemini recommends < 5MB inline data
    const MAX_BASE64_CHARS = 4 * 1024 * 1024;
    if (imageBase64.length > MAX_BASE64_CHARS) {
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 3MB.' },
        { status: 413 }
      );
    }

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validMimeTypes.includes(mimeType)) {
      return NextResponse.json(
        { error: 'Invalid image type. Use JPEG, PNG, GIF, or WebP.' },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,")
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await generateWithRetry(ai, {
      model: 'gemini-2.5-flash',
      config: jsonConfig(RESPONSE_SCHEMA),
      contents: [
        {
          role: 'user',
          parts: [
            { text: PROMPT },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              },
            },
          ],
        },
      ],
    });

    await recordAiUsage(guard.userId, 'analyze-food', response.usageMetadata?.totalTokenCount);

    const parsed = parseGeminiJson<{
      name: string;
      calories: number;
      protein: number;
      fat: number;
      carbs: number;
      confidence: string;
      notes: string;
    }>(response.text);

    return NextResponse.json(parsed);
  } catch (error) {
    // Generic message only — never echo raw model output or error internals.
    console.error('Error analyzing food with Gemini:', error);
    return NextResponse.json(
      { error: 'Analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}
