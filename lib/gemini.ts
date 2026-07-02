/**
 * Gemini call helpers: transient-failure retry with exponential backoff.
 *
 * `gemini-2.5-flash` intermittently returns 503 ``UNAVAILABLE`` ("high demand")
 * or 429. These are transient, so a couple of backed-off retries absorb them
 * before the user ever sees an error. Non-transient errors (400, auth, parse)
 * are re-thrown immediately so they surface fast.
 */

import type { GoogleGenAI } from '@google/genai';

type GenerateRequest = Parameters<GoogleGenAI['models']['generateContent']>[0];

export interface RetryOptions {
  /** Total attempts including the first (default 3). */
  attempts?: number;
  /** Base delay in ms for the exponential schedule (default 400). */
  baseMs?: number;
}

/** True for transient upstream failures worth retrying (overload / rate / 5xx). */
function isTransient(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (typeof status === 'number' && [429, 500, 502, 503, 504].includes(status)) {
    return true;
  }
  const msg = (err instanceof Error ? err.message : String(err)).toUpperCase();
  return /UNAVAILABLE|OVERLOAD|HIGH DEMAND|RESOURCE_EXHAUSTED|INTERNAL|\b50\d\b|\b429\b/.test(msg);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run an async operation, retrying transient failures with exponential backoff
 * plus jitter.
 *
 * Parameters
 * ----------
 * fn : () => Promise<T>
 *     The operation to run.
 * opts : RetryOptions
 *     attempts (default 3) and baseMs (default 400).
 *
 * Returns
 * -------
 * Promise<T>
 *     The result of the first successful attempt.
 *
 * Raises
 * ------
 * The last error if all attempts fail, or immediately for non-transient errors.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 400;
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts - 1 || !isTransient(err)) throw err;
      // Exponential backoff (baseMs * 2^attempt) with up to baseMs of jitter.
      await sleep(baseMs * 2 ** attempt + Math.random() * baseMs);
    }
  }
  throw lastErr; // unreachable: the loop either returns or throws
}

/**
 * ``ai.models.generateContent`` wrapped with {@link withRetry} so transient
 * Gemini overload/rate errors are absorbed.
 */
export function generateWithRetry(
  ai: GoogleGenAI,
  request: GenerateRequest,
  opts?: RetryOptions,
) {
  return withRetry(() => ai.models.generateContent(request), opts);
}
