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
  'analyze-food':   { maxRequests: 10, windowMs:    60_000 },  // 10/min — image processing is expensive
  'coach':          { maxRequests: 20, windowMs:    60_000 },  // 20/min
  'habit-report':   { maxRequests: 5,  windowMs:    60_000 },  // 5/min — 7-day analysis is heavy
  'recommend':      { maxRequests: 10, windowMs:    60_000 },  // 10/min — profile-aware recommendation
  'weekly-report':  { maxRequests: 3,  windowMs: 3_600_000 },  // 3/hour — comprehensive weekly synthesis
} as const satisfies Record<string, RateLimitConfig>;
