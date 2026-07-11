/**
 * POST /api/consent
 *
 * Records the authenticated user's consent timestamp in profiles.consented_at
 * plus the 18+ attestation in profiles.adult_confirmed_at (APPI hygiene —
 * research participation is 18+; minors use the app in guest mode).
 * Called by the /consent page on submission.
 *
 * Request body: { adultConfirmed: true }
 * Response (200): { consentedAt: string }
 * 400 — adultConfirmed flag missing/false
 * 401 — not authenticated
 * 409 — already consented
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerUser, createServerSupabase } from '@/lib/supabase-server';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let adultConfirmed = false;
  try {
    const body = await req.json();
    adultConfirmed = body?.adultConfirmed === true;
  } catch {
    // no/invalid JSON body — adultConfirmed stays false
  }
  if (!adultConfirmed) {
    return NextResponse.json(
      { error: '18歳以上であることの確認が必要です' },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();

  // Check if already consented
  const { data: profile } = await supabase
    .from('profiles')
    .select('consented_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.consented_at) {
    return NextResponse.json({ consentedAt: profile.consented_at }, { status: 409 });
  }

  const consentedAt = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({ consented_at: consentedAt, adult_confirmed_at: consentedAt })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ consentedAt });
}
