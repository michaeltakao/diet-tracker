/**
 * POST /api/sus — submit the standard System Usability Scale survey
 * (FTUE roadmap P0 #10, Day-14+ gate; components/SusSurveyCard.tsx).
 *
 * Auth-only (401 — never 403, which would trigger httpClient's access-code
 * prompt; this mirrors app/api/push-subscribe/route.ts). One submission per
 * user, enforced by the UNIQUE(user_id) constraint on sus_responses
 * (supabase/migrations/019_sus_responses.sql) — a second POST 409s.
 *
 * total_score is ALWAYS computed server-side via lib/sus.ts scoreSus() from
 * the validated item scores; a client-submitted total is never trusted or
 * even accepted in the request body.
 *
 * Request body: { item1..item10: number (1-5 each) }
 * Response (200): { totalScore: number }
 * 400 — missing/out-of-range item scores
 * 401 — not authenticated
 * 409 — already submitted
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerUser, createServerSupabase } from '@/lib/supabase-server';
import { scoreSus, type SusItemScores } from '@/lib/sus';

const ITEM_KEYS: readonly (keyof SusItemScores)[] = [
  'item1', 'item2', 'item3', 'item4', 'item5',
  'item6', 'item7', 'item8', 'item9', 'item10',
];

function parseItems(body: unknown): SusItemScores | null {
  if (typeof body !== 'object' || body === null) return null;
  const record = body as Record<string, unknown>;
  const items = {} as SusItemScores;
  for (const key of ITEM_KEYS) {
    const v = record[key];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) return null;
    items[key] = v;
  }
  return items;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // invalid JSON → body stays null → 400 below
  }
  const items = parseItems(body);
  if (!items) {
    return NextResponse.json({ error: 'Invalid item scores' }, { status: 400 });
  }

  const totalScore = scoreSus(items);

  const supabase = await createServerSupabase();
  const { error } = await supabase.from('sus_responses').insert({
    user_id: user.id,
    item_1: items.item1,
    item_2: items.item2,
    item_3: items.item3,
    item_4: items.item4,
    item_5: items.item5,
    item_6: items.item6,
    item_7: items.item7,
    item_8: items.item8,
    item_9: items.item9,
    item_10: items.item10,
    total_score: totalScore,
  });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
    }
    console.error('[SUS_INSERT_ERROR]', error);
    return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ totalScore });
}
