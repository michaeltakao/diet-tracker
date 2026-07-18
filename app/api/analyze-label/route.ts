import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { generateWithRetry, jsonConfig, parseGeminiJson } from '@/lib/gemini';
import { guardAiRoute, recordAiUsage } from '@/lib/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * Nutrition-label (栄養成分表示) photo → structured values via Gemini vision.
 * Guard/inlineData handling mirrors /api/analyze-food; only the prompt and
 * schema differ: values are transcribed from the printed label (not
 * estimated), and the basis (per 100 g vs per serving) is made explicit so
 * the client can scale correctly.
 */

const apiKey = process.env.GEMINI_API_KEY;

const PROMPT = `Read the nutrition facts label (栄養成分表示) in this image and transcribe its values.
- Transcribe printed values exactly; do not estimate missing ones.
- "basis" is what the printed values refer to: per 100g → "per100g"; per serving (1袋/1食/1本/1個あたり) → "perServing".
- If the serving size in grams is printed (e.g. 1袋(35g)), set servingG.
- Sodium: if the label prints 食塩相当量 X g, convert to sodiumMg = X / 2.54 * 1000. If it prints ナトリウム in mg, use that directly. Omit if absent.
- fiberG = 食物繊維 in grams; omit if absent.
- "name" = product name if visible on the package; omit if not visible.
- confidence reflects how legible the label is.`;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name:       { type: Type.STRING, description: 'product name if visible' },
    basis:      { type: Type.STRING, enum: ['per100g', 'perServing'] },
    servingG:   { type: Type.NUMBER, description: 'serving size in grams, when printed' },
    calories:   { type: Type.NUMBER, description: 'kcal (エネルギー)' },
    protein:    { type: Type.NUMBER, description: 'grams (たんぱく質)' },
    fat:        { type: Type.NUMBER, description: 'grams (脂質)' },
    carbs:      { type: Type.NUMBER, description: 'grams (炭水化物)' },
    sodiumMg:   { type: Type.NUMBER, description: 'sodium in mg (from 食塩相当量 ÷ 2.54 × 1000, or ナトリウム mg)' },
    fiberG:     { type: Type.NUMBER, description: 'grams (食物繊維)' },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
  },
  required: ['basis', 'calories', 'protein', 'fat', 'carbs', 'confidence'],
};

/** Response shape — mirrored by LabelAnalysisResult in components/PhotoUpload.tsx. */
interface LabelAnalysis {
  name?: string;
  basis: 'per100g' | 'perServing';
  servingG?: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  sodiumMg?: number;
  fiberG?: number;
  confidence: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await guardAiRoute(request, 'analyze-label');
  if ('blocked' in guard) return guard.blocked;

  const rl = checkRateLimit(guard.clientId, 'analyze-label', RATE_LIMITS['analyze-label']);
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

    await recordAiUsage(guard.userId, 'analyze-label', response.usageMetadata?.totalTokenCount);

    const parsed = parseGeminiJson<LabelAnalysis>(response.text);
    return NextResponse.json(parsed);
  } catch (error) {
    // Generic message only — never echo raw model output or error internals.
    console.error('Error analyzing label with Gemini:', error);
    return NextResponse.json(
      { error: 'Analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}
