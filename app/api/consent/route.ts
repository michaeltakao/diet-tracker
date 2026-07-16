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
import {
  getServerUser,
  createServerSupabase,
  createServiceSupabase,
} from '@/lib/supabase-server';

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
  const { data: updated, error } = await supabase
    .from('profiles')
    .update({ consented_at: consentedAt, adult_confirmed_at: consentedAt })
    .eq('id', user.id)
    .select('id');

  if (error) {
    // Generic message only — never echo DB error internals to the client.
    console.error('[CONSENT_UPDATE_ERROR]', error);
    return NextResponse.json({ error: 'Consent update failed. Please try again.' }, { status: 500 });
  }

  // Zero rows matched → the profiles row is missing (trigger failure or
  // pre-001 user). RLS has no INSERT policy on profiles, so recover with the
  // service-role client. Never report success that wasn't persisted.
  if (!updated || updated.length === 0) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[consent] profiles row missing and no service-role key — cannot record consent for', user.id);
      return NextResponse.json(
        { error: '同意を保存できませんでした。時間をおいて再度お試しください。' },
        { status: 500 },
      );
    }

    const svc = await createServiceSupabase();
    // id comes from the verified session, never from the request body.
    // display_name/avatar_url mirror the handle_new_user() trigger (001:53-58).
    const { error: upsertError } = await svc
      .from('profiles')
      .upsert(
        {
          id: user.id,
          consented_at: consentedAt,
          adult_confirmed_at: consentedAt,
          display_name:
            (user.user_metadata?.full_name as string | undefined) ??
            user.email?.split('@')[0] ??
            null,
          avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        },
        { onConflict: 'id' },
      );

    if (upsertError) {
      console.error('[consent] recovery upsert failed:', upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ consentedAt });
}
