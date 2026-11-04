/**
 * Build stamp for analysed log rows (vault ADR-008 P0-11, migration 027).
 *
 * food_logs / weight_logs / workout_logs writes carry the build that wrote
 * them, so the study can show every participant used the frozen build.
 *
 *   build_sha   — NEXT_PUBLIC_BUILD_SHA, set in next.config.ts from
 *                 VERCEL_GIT_COMMIT_SHA ('local' off Vercel).
 *   study_build — NEXT_PUBLIC_STUDY_BUILD === '1' (lib/study-build.ts).
 *
 * Both are inlined at build time. They are read inside the function (not as
 * module constants) only so tests can vary them; in a built bundle the result
 * is constant.
 *
 * The bulk localStorage → Supabase migration (lib/migrate.ts) does NOT stamp:
 * it uploads past rows, and NULL means "unknown build".
 */
import type { PostgrestError } from '@supabase/supabase-js';

export interface BuildStamp {
  build_sha:   string | null;
  study_build: boolean;
}

export function buildStamp(): BuildStamp {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA;
  return {
    build_sha:   sha && sha.length > 0 ? sha : null,
    study_build: process.env.NEXT_PUBLIC_STUDY_BUILD === '1',
  };
}

/**
 * PostgREST's "column not in schema cache" error for one of the stamp columns
 * — i.e. this code is deployed against a database without migration 027.
 */
function isMissingStampColumn(error: Pick<PostgrestError, 'code' | 'message'>): boolean {
  return error.code === 'PGRST204'
    && (error.message.includes('build_sha') || error.message.includes('study_build'));
}

/**
 * Run a stamped write; if the database does not have the stamp columns yet,
 * retry once unstamped so the row itself is not lost.
 *
 * Without this, deploying before migration 027 is applied would make every
 * food / weight / workout sync fail (writes are fire-and-forget, so the user
 * would see nothing). Any other error is returned unchanged.
 *
 *   const { error } = await writeStamped((stamp) =>
 *     ctx.supabase.from('weight_logs').upsert({ ...row, ...stamp }, opts));
 */
export async function writeStamped(
  write: (stamp: BuildStamp | Record<string, never>) => PromiseLike<{ error: PostgrestError | null }>,
): Promise<{ error: PostgrestError | null }> {
  const first = await write(buildStamp());
  if (first.error && isMissingStampColumn(first.error)) {
    console.warn('[build-stamp] stamp columns missing (migration 027 not applied); wrote row unstamped');
    return write({});
  }
  return first;
}
