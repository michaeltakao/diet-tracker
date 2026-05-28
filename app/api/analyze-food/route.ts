import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getServerUser } from '@/lib/supabase-server';

const apiKey = process.env.GEMINI_API_KEY;

const PROMPT = `Analyze the food in this image and estimate its nutritional content.
Return ONLY valid JSON in this exact format:
{
  "name": "food name in English or Japanese",
  "calories": <number>,
  "protein": <number in grams>,
  "fat": <number in grams>,
  "carbs": <number in grams>,
  "confidence": "high|medium|low",
  "notes": "brief note about the estimate"
}
Assume a typical single serving. Be realistic and conservative with estimates.
Do not include markdown code block formatting in your response, just the raw JSON.`;

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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

    const raw = (response.text ?? '').trim();

    // Strip markdown code fences if Gemini adds them
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Could not parse JSON from Gemini response', raw },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      name: string;
      calories: number;
      protein: number;
      fat: number;
      carbs: number;
      confidence: string;
      notes: string;
    };

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Error analyzing food with Gemini:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Analysis failed: ${message}` },
      { status: 500 }
    );
  }
}
