/**
 * Shared guards for the AI API routes.
 *
 * These routes are usable in *guest* mode (no Supabase login): the deployment is
 * intended for personal/single-user use, so instead of rejecting anonymous
 * callers we rate-limit them by client IP. An optional shared-secret gate
 * (``APP_ACCESS_CODE``) protects a public deployment from anonymous abuse of the
 * paid Gemini key without requiring a full auth backend.
 */

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getServerUser } from '@/lib/supabase-server';

/**
 * Resolve a stable identifier for rate limiting.
 *
 * Prefers the authenticated Supabase user id when present; otherwise falls back
 * to the proxy-set ``x-real-ip`` (Vercel/most proxies set this to the true client
 * IP — unlike the first ``x-forwarded-for`` entry, which is client-spoofable),
 * then ``x-forwarded-for``, then a shared ``'guest'`` bucket.
 *
 * Parameters
 * ----------
 * request : Request
 *     The incoming route-handler request.
 *
 * Returns
 * -------
 * str
 *     The rate-limit key.
 */
export async function resolveClientId(request: Request): Promise<string> {
  const user = await getServerUser();
  return (
    user?.id
    ?? request.headers.get('x-real-ip')?.trim()
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'guest'
  );
}

/** Constant-time string compare that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Optional shared-secret gate for the AI routes.
 *
 * Disabled (returns ``null``) when ``APP_ACCESS_CODE`` is unset, so local dev and
 * Supabase-authenticated deployments need no extra configuration. When the env
 * var is set, requests must send a matching ``x-access-code`` header or receive a
 * 403 response.
 *
 * Parameters
 * ----------
 * request : Request
 *     The incoming route-handler request.
 *
 * Returns
 * -------
 * NextResponse | null
 *     A 403 response when the gate is enabled and the code is missing/wrong;
 *     ``null`` when the request may proceed.
 */
export function accessGateBlocked(request: Request): NextResponse | null {
  const required = process.env.APP_ACCESS_CODE;
  if (!required) return null; // gate disabled
  const provided = request.headers.get('x-access-code') ?? '';
  if (safeEqual(provided, required)) return null;
  return NextResponse.json({ error: 'Access code required' }, { status: 403 });
}
