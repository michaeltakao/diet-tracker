/**
 * ADR-008 P0-4: /api/generate-workout returns the deterministic plan with
 * `narrative: null` (200) when Gemini is unavailable — missing key, Gemini
 * error, Gemini quota, or the user's own daily AI quota.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextResponse } from 'next/server';

const guard = vi.fn();
const generate = vi.fn();
const recordAiUsage = vi.fn();

vi.mock('@/lib/api-guard', () => ({
  guardAiRoute: (...a: unknown[]) => guard(...a),
  recordAiUsage: (...a: unknown[]) => recordAiUsage(...a),
}));
vi.mock('@/lib/gemini', async (orig) => ({
  ...(await orig<typeof import('@/lib/gemini')>()),
  generateWithRetry: (...a: unknown[]) => generate(...a),
}));

const { POST } = await import('@/app/api/generate-workout/route');

let n = 0;
function req(): Request {
  return new Request('http://localhost/api/generate-workout', {
    method: 'POST',
    body: JSON.stringify({ goal: 'hypertrophy', timeAvailableMin: 30, availableEquipment: ['dumbbell'] }),
  });
}
// Unique clientId per call so the in-memory rate limiter never trips.
function allow() {
  guard.mockResolvedValue({ clientId: `c${n++}`, userId: 'u1' });
}

describe('generate-workout fallback', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    guard.mockReset(); generate.mockReset(); recordAiUsage.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('Gemini throws → 200 with plan and narrative null', async () => {
    allow();
    generate.mockRejectedValue(new Error('upstream 500'));
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.narrative).toBeNull();
    expect(body.plan.exercises.length).toBeGreaterThan(0);
    expect(recordAiUsage).not.toHaveBeenCalled();
  });

  it('Gemini quota error → still 200 + plan', async () => {
    allow();
    generate.mockRejectedValue(Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 }));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).plan.exercises.length).toBeGreaterThan(0);
  });

  it('no GEMINI_API_KEY → 200 + plan, Gemini never called', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    allow();
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.narrative).toBeNull();
    expect(body.plan.exercises.length).toBeGreaterThan(0);
    expect(generate).not.toHaveBeenCalled();
  });

  it('daily AI quota used up → 200 + plan, Gemini never called', async () => {
    guard.mockResolvedValue({
      blocked: NextResponse.json({ error: 'limit' }, { status: 429 }),
      quotaOnly: { clientId: `c${n++}`, userId: 'u1' },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).narrative).toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });

  it('auth / gate block stays blocked', async () => {
    guard.mockResolvedValue({ blocked: NextResponse.json({ error: 'code' }, { status: 403 }) });
    const res = await POST(req());
    expect(res.status).toBe(403);
  });

  it('Gemini success → narrative passed through and usage recorded', async () => {
    allow();
    generate.mockResolvedValue({
      text: JSON.stringify({ sessionName: 'S', notes: 'N', motivationMessage: 'M' }),
      usageMetadata: { totalTokenCount: 10 },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).narrative).toEqual({ sessionName: 'S', notes: 'N', motivationMessage: 'M' });
    expect(recordAiUsage).toHaveBeenCalledWith('u1', 'generate-workout', 10);
  });
});
