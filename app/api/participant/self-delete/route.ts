/**
 * DELETE /api/participant/self-delete
 *
 * APPI / GDPR data-erasure endpoint. Deletes all personal data for the
 * authenticated user. This is a permanent, irreversible operation.
 *
 * Deletion cascade (via FK ON DELETE CASCADE from public.profiles):
 *   food_logs, workout_logs, weight_logs, water_logs, badges,
 *   personal_records, checkins, training_programs, tdee_estimates,
 *   recommendation_feedback — all removed when profiles row is deleted.
 *
 * The auth.users row is also deleted so the email address is purged.
 * After deletion the session is invalidated and the client must redirect
 * to /login.
 *
 * Response (200): { deletedAt: string }
 * 401 — not authenticated
 * 500 — deletion error (partial deletion may have occurred; log and alert)
 */

import { NextResponse } from 'next/server';
import { getServerUser, createServiceSupabase } from '@/lib/supabase-server';

export async function DELETE(): Promise<NextResponse> {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = await createServiceSupabase();

  // Delete the profile row — all user data cascades.
  const { error: profileErr } = await svc
    .from('profiles')
    .delete()
    .eq('id', user.id);

  if (profileErr) {
    console.error('[self-delete] profiles delete failed:', profileErr);
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  // Delete the auth user (purges email and login credentials).
  // Uses the GoTrue Admin API via the service-role key.
  const { error: authErr } = await svc.auth.admin.deleteUser(user.id);
  if (authErr) {
    // Profile data is already gone but the login credential survives — the
    // erasure is INCOMPLETE and must not be reported as success. The session
    // is still valid, so the client can retry: the profiles delete is a no-op
    // and this call runs again.
    console.error('[self-delete] auth.admin.deleteUser failed:', authErr);
    return NextResponse.json(
      { error: 'アカウント削除が完了しませんでした。もう一度お試しください。' },
      { status: 500 },
    );
  }

  return NextResponse.json({ deletedAt: new Date().toISOString() });
}
