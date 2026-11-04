/**
 * Build stamp (vault ADR-008 P0-11): the values written to log rows, and the
 * fallback that keeps a row when migration 027 is not applied yet.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PostgrestError } from '@supabase/supabase-js';
import { buildStamp, writeStamped } from '@/lib/build-stamp';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('buildStamp', () => {
  it('reports the inlined sha and the study flag', () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_SHA', 'abc123');
    vi.stubEnv('NEXT_PUBLIC_STUDY_BUILD', '1');
    expect(buildStamp()).toEqual({ build_sha: 'abc123', study_build: true });
  });

  it('is { null, false } when neither is set', () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_SHA', '');
    vi.stubEnv('NEXT_PUBLIC_STUDY_BUILD', '');
    expect(buildStamp()).toEqual({ build_sha: null, study_build: false });
  });

  it("treats anything but '1' as not a study build", () => {
    vi.stubEnv('NEXT_PUBLIC_STUDY_BUILD', 'true');
    expect(buildStamp().study_build).toBe(false);
  });
});

describe('writeStamped', () => {
  const pgError = (code: string, message: string) => new PostgrestError({ code, message, details: '', hint: '' });
  const missingColumn = pgError('PGRST204', "Could not find the 'build_sha' column of 'weight_logs' in the schema cache");

  it('passes the stamp to the write', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_SHA', 'abc123');
    vi.stubEnv('NEXT_PUBLIC_STUDY_BUILD', '1');
    const write = vi.fn(async (_stamp: unknown) => ({ error: null as PostgrestError | null }));
    expect(await writeStamped(write)).toEqual({ error: null });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({ build_sha: 'abc123', study_build: true });
  });

  it('retries once without the stamp when the columns do not exist (027 not applied)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const write = vi.fn()
      .mockResolvedValueOnce({ error: missingColumn })
      .mockResolvedValueOnce({ error: null });
    expect(await writeStamped(write)).toEqual({ error: null });
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith({});
  });

  it('does not retry on any other error', async () => {
    const other = pgError('42501', 'new row violates row-level security policy');
    const write = vi.fn(async () => ({ error: other as PostgrestError | null }));
    expect(await writeStamped(write)).toEqual({ error: other });
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('does not retry when a different column is missing', async () => {
    const otherColumn = pgError('PGRST204', "Could not find the 'fiber_g' column of 'food_logs' in the schema cache");
    const write = vi.fn(async () => ({ error: otherColumn as PostgrestError | null }));
    expect(await writeStamped(write)).toEqual({ error: otherColumn });
    expect(write).toHaveBeenCalledTimes(1);
  });
});
