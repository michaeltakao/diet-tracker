/**
 * GET /api/research/export
 *
 * Researcher-only: export participant data as JSON or CSV.
 *
 * Only rows of users whose profiles.consented_at is set are exported — i.e.
 * the researcher has checked their signed paper consent form (vault ADR-007).
 * Signing in no longer implies consent, so an unfiltered export would include
 * people who never agreed to research use. Rows with no user (guest
 * beta_feedback) are excluded for the same reason.
 *
 * Query params:
 *   user_id  — filter to a specific participant (optional; omit for all).
 *              A user without consented_at yields an empty export.
 *   table    — 'food_logs' | 'weight_logs' | 'workout_logs' | 'recommendation_feedback'
 *              | 'sus_responses' | 'beta_feedback'
 *              (optional; omit for full export as nested JSON)
 *   format   — 'json' (default) | 'csv'
 *
 * Response: application/json or text/csv with Content-Disposition attachment.
 *
 * 401 — not authenticated
 * 403 — not a researcher
 * 400 — invalid table param
 */

import { NextResponse } from 'next/server';
import { getServerUser, createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import type { ResearcherAccessLogInsert } from '@/lib/database.types';

type SupportedTable =
  | 'food_logs' | 'weight_logs' | 'workout_logs' | 'recommendation_feedback'
  | 'sus_responses' | 'beta_feedback';

const SUPPORTED_TABLES: SupportedTable[] = [
  'food_logs',
  'weight_logs',
  'workout_logs',
  'recommendation_feedback',
  'sus_responses',
  'beta_feedback',
];

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape  = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
  ].join('\n');
}

export async function GET(request: Request): Promise<NextResponse> {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServerSupabase();

  // Role check
  const { data: self } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (self?.role !== 'researcher') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url       = new URL(request.url);
  const userId    = url.searchParams.get('user_id') ?? undefined;
  const tableName = url.searchParams.get('table') as SupportedTable | null;
  const format    = url.searchParams.get('format') ?? 'json';

  // Validate table param
  if (tableName && !SUPPORTED_TABLES.includes(tableName)) {
    return NextResponse.json(
      { error: `Invalid table. Choose one of: ${SUPPORTED_TABLES.join(', ')}` },
      { status: 400 },
    );
  }

  // Service client bypasses RLS for cross-user reads.
  const svc = await createServiceSupabase();

  // IRB audit log
  const logEntry: ResearcherAccessLogInsert = {
    researcher_id:  user.id,
    endpoint:       '/api/research/export',
    filter_user_id: userId ?? null,
    table_name:     tableName ?? null,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (svc as any).from('researcher_access_log').insert(logEntry)
    .then(({ error }: { error: unknown }) => {
      // Fire-and-forget by design (the audit write must not block the
      // researcher's response), but a silent failure would leave an IRB
      // access log with an invisible hole. Surface it in server logs.
      if (error) console.error('[RESEARCHER_ACCESS_LOG_ERROR]', '/api/research/export', error);
    })
    .catch((err: unknown) => console.error('[RESEARCHER_ACCESS_LOG_ERROR]', '/api/research/export', err));

  // Consent filter: the only users whose rows may leave this endpoint.
  // Sized for this study (tens of participants): the id list travels in the
  // query string and the lookup is one unpaginated page (PostgREST max-rows).
  // Move the join into SQL (an RPC) before using this with hundreds of users.
  const { data: consented, error: consentErr } = await svc
    .from('profiles')
    .select('id')
    .not('consented_at', 'is', null);
  if (consentErr) {
    console.error('[RESEARCH_EXPORT_ERROR] consent lookup failed:', consentErr);
    return NextResponse.json({ error: 'Export failed. Please try again.' }, { status: 500 });
  }
  const consentedIds = (consented ?? []).map((p: { id: string }) => p.id);
  const exportIds = userId ? consentedIds.filter((id) => id === userId) : consentedIds;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // ── Single-table export ─────────────────────────────────────────────────────
  if (tableName) {
    const { data, error } = await svc.from(tableName).select('*').in('user_id', exportIds);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as Record<string, unknown>[];

    if (format === 'csv') {
      return new NextResponse(toCsv(rows), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="diet-tracker_${tableName}_${timestamp}.csv"`,
        },
      });
    }

    return NextResponse.json(rows, {
      headers: {
        'Content-Disposition': `attachment; filename="diet-tracker_${tableName}_${timestamp}.json"`,
      },
    });
  }

  // ── Full multi-table export (JSON only) ─────────────────────────────────────
  const buildQuery = (table: SupportedTable) =>
    svc.from(table).select('*').in('user_id', exportIds);

  const [food, weight, workout, feedback, sus, betaFeedback] = await Promise.all(
    SUPPORTED_TABLES.map(buildQuery),
  );

  const failed = [food, weight, workout, feedback, sus, betaFeedback].find((r) => r.error);
  if (failed?.error) {
    // An empty array must mean "no rows", never "the query failed".
    console.error('[RESEARCH_EXPORT_ERROR]', failed.error);
    return NextResponse.json({ error: 'Export failed. Please try again.' }, { status: 500 });
  }

  const payload = {
    exported_at: new Date().toISOString(),
    filter_user_id: userId ?? null,
    food_logs:                (food.data         ?? []) as Record<string, unknown>[],
    weight_logs:              (weight.data        ?? []) as Record<string, unknown>[],
    workout_logs:             (workout.data       ?? []) as Record<string, unknown>[],
    recommendation_feedback:  (feedback.data      ?? []) as Record<string, unknown>[],
    sus_responses:            (sus.data           ?? []) as Record<string, unknown>[],
    beta_feedback:            (betaFeedback.data  ?? []) as Record<string, unknown>[],
  };

  return NextResponse.json(payload, {
    headers: {
      'Content-Disposition': `attachment; filename="diet-tracker_full_export_${timestamp}.json"`,
    },
  });
}
