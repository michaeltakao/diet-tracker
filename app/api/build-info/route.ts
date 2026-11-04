/**
 * GET /api/build-info — which build is deployed (vault ADR-008 P0-11).
 *
 * Read by scripts/check-study-freeze.mjs, which compares `sha` with the git
 * tag `study-v1` once a week during the study. Both values are inlined at
 * build time (next.config.ts, lib/study-build.ts); nothing secret — the
 * commit SHA of a private repo and a boolean.
 *
 * No auth, and outside the proxy (matcher excludes /api).
 */
import { NextResponse } from 'next/server';
import { buildStamp } from '@/lib/build-stamp';

export function GET(): NextResponse {
  const { build_sha, study_build } = buildStamp();
  return NextResponse.json(
    { sha: build_sha, studyBuild: study_build },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
