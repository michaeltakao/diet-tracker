/**
 * POST /api/consent
 *
 * Records the authenticated user's consent timestamp in profiles.consented_at.
 * Called by the /consent page on submission.
 *
 * Response (200): { consentedAt: string }
 * 401 — not authenticated
 * 409 — already consented
 */

import { NextResponse } from 'next/server';
import { getServerUser, createServerSupabase } from '@/lib/supabase-server';

export async function POST(): Promise<NextResponse> {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    .update({ consented_at: consentedAt })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ consentedAt });
}
