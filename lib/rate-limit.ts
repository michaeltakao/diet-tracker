/**
 * In-memory sliding window rate limiter.
 * Resets on server restart — acceptable for single-instance deployment.
 * Key: `${userId}:${route}`
 */

interface Window {
  timestamps: number[];
}

const store = new Map<string, Window>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAfterMs: number;
}

export function checkRateLimit(
  userId: string,
  route: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `${userId}:${route}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let window = store.get(key);
  if (!window) {
    window = { timestamps: [] };
    store.set(key, window);
  }

  // Evict timestamps outside the current window
  window.timestamps = window.timestamps.filter(t => t > windowStart);

  if (window.timestamps.length >= config.maxRequests) {
    const oldestInWindow = window.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetAfterMs: oldestInWindow + config.windowMs - now,
    };
  }

  window.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.maxRequests - window.timestamps.length,
    resetAfterMs: 0,
  };
}

// Per-route limits
export const RATE_LIMITS = {
  'analyze-food':     { maxRequests: 10, windowMs:    60_000 },
  'coach':            { maxRequests: 20, windowMs:    60_000 },
  'habit-report':     { maxRequests: 5,  windowMs:    60_000 },
  'recommend':        { maxRequests: 10, windowMs:    60_000 },
  'weekly-report':    { maxRequests: 3,  windowMs: 3_600_000 },
  'suggest-workout':  { maxRequests: 10, windowMs:    60_000 },
} as const satisfies Record<string, RateLimitConfig>;

/**
 * Durable per-user daily quotas (successful calls per JST calendar day),
 * layered on top of the in-memory per-minute limits above. Enforced by
 * guardAiRoute() against the Supabase `ai_usage` table for authenticated
 * users; guests are covered by APP_ACCESS_CODE + the in-memory limiter only.
 * Generous by design (research beta) — cost control, not punishment.
 */
export const DAILY_QUOTAS = {
  'analyze-food':    100,
  'coach':           200,
  'habit-report':     20,
  'recommend':       100,
  'weekly-report':    20,
  'suggest-workout':  50,
} as const satisfies Record<keyof typeof RATE_LIMITS, number>;

/** Cap on a user's total successful AI calls per JST day, across all routes. */
export const GLOBAL_DAILY_QUOTA = 400;

export type AiRouteName = keyof typeof DAILY_QUOTAS;
