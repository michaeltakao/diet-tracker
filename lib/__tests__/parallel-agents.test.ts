import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock only the network edge (generateWithRetry); everything else in
// lib/gemini stays real so the model constant is the pinned one.
const generateWithRetry = vi.fn();
vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>();
  return { ...actual, generateWithRetry: (...args: unknown[]) => generateWithRetry(...args) };
});

import { runParallelAgents } from '../parallel-agents';

const task = (id: string) => ({ id, systemPrompt: 'sys', userMessage: 'msg' });

describe('runParallelAgents', () => {
  beforeEach(() => generateWithRetry.mockReset());

  it('passes totalTokenCount through on success', async () => {
    generateWithRetry
      .mockResolvedValueOnce({ text: ' a ', usageMetadata: { totalTokenCount: 120 } })
      .mockResolvedValueOnce({ text: 'b', usageMetadata: { totalTokenCount: 80 } });

    const results = await runParallelAgents('k', [task('x'), task('y')]);

    expect(results).toEqual([
      { id: 'x', text: 'a', tokens: 120 },
      { id: 'y', text: 'b', tokens: 80 },
    ]);
  });

  it('reports 0 tokens when usageMetadata is missing', async () => {
    generateWithRetry.mockResolvedValueOnce({ text: 'a' });
    const [r] = await runParallelAgents('k', [task('x')]);
    expect(r.tokens).toBe(0);
  });

  it('reports 0 tokens and the error on failure without throwing', async () => {
    generateWithRetry
      .mockResolvedValueOnce({ text: 'ok', usageMetadata: { totalTokenCount: 50 } })
      .mockRejectedValueOnce(new Error('UNAVAILABLE'));

    const results = await runParallelAgents('k', [task('x'), task('y')]);

    expect(results[0].tokens).toBe(50);
    expect(results[1]).toEqual({ id: 'y', text: '', tokens: 0, error: 'UNAVAILABLE' });
    expect(results.reduce((s, r) => s + r.tokens, 0)).toBe(50);
  });
});
