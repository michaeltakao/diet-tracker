/**
 * next.config.ts refuses a Vercel production build that is not a study build
 * (vault ADR-008 P0-11), and inlines the build SHA.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

async function loadConfig() {
  vi.resetModules();
  return (await import('@/next.config')).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('next.config study gate', () => {
  it('throws for a production build without NEXT_PUBLIC_STUDY_BUILD=1', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_STUDY_BUILD', '');
    await expect(loadConfig()).rejects.toThrow(/NEXT_PUBLIC_STUDY_BUILD/);
  });

  it('builds production with the flag set', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_STUDY_BUILD', '1');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc123');
    expect((await loadConfig()).env?.NEXT_PUBLIC_BUILD_SHA).toBe('abc123');
  });

  it('does not gate previews or local builds', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_STUDY_BUILD', '');
    await expect(loadConfig()).resolves.toBeDefined();
    vi.stubEnv('VERCEL_ENV', '');
    await expect(loadConfig()).resolves.toBeDefined();
  });

  it("uses 'local' as the SHA off Vercel", async () => {
    vi.stubEnv('VERCEL_ENV', '');
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    expect((await loadConfig()).env?.NEXT_PUBLIC_BUILD_SHA).toBe('local');
  });
});
