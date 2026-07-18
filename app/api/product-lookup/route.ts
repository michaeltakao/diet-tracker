import { NextResponse } from 'next/server';
import { guardAiRoute, recordAiUsage } from '@/lib/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isValidBarcode, normalizeOffProduct } from '@/lib/off';

/**
 * Barcode → Open Food Facts product lookup (proxy).
 *
 * Not an LLM route, but it reuses guardAiRoute off-label so the same access
 * gate (APP_ACCESS_CODE / fail-closed anonymous policy) and durable daily
 * quota meter the outbound OFF traffic; its ai_usage rows charge 0 tokens.
 * POST (not GET) so postJson's 403 access-code prompt flow applies.
 *
 * SSRF stance: the outbound URL is allowlisted by construction — constant
 * https base + a digits-only path segment (isValidBarcode) + constant query.
 * No caller-controlled host, scheme, or path can ever be fetched
 * (lib/push-endpoint.ts philosophy).
 */

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product/';
const OFF_FIELDS =
  'product_name,brands,nutriments,serving_quantity,serving_quantity_unit';

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await guardAiRoute(request, 'product-lookup');
  if ('blocked' in guard) return guard.blocked;

  const rl = checkRateLimit(guard.clientId, 'product-lookup', RATE_LIMITS['product-lookup']);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before retrying.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.resetAfterMs / 1000)) },
      }
    );
  }

  let barcode: unknown;
  try {
    ({ barcode } = await request.json() as { barcode?: unknown });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (typeof barcode !== 'string' || !isValidBarcode(barcode)) {
    return NextResponse.json(
      { error: 'Invalid barcode. Expected 8–14 digits.' },
      { status: 400 }
    );
  }

  let offJson: unknown;
  try {
    // eslint-disable-next-line no-restricted-globals -- server-side outbound call to OFF; the postJson rule targets client→internal-API calls
    const res = await fetch(`${OFF_BASE}${barcode}.json?fields=${OFF_FIELDS}`, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'diet-tracker/1.0 (research beta)' },
    });
    if (res.status === 404) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }
    if (!res.ok) throw new Error(`OFF responded ${res.status}`);
    offJson = await res.json();
  } catch (error) {
    // Timeout / network / upstream 5xx — generic message, details to the log.
    console.error('[product-lookup] OFF fetch failed:', error);
    return NextResponse.json(
      { error: 'Product lookup failed. Please try again.' },
      { status: 502 }
    );
  }

  const product = normalizeOffProduct(offJson);
  if (!product) {
    // Exists upstream but unusable for logging (no name / no kcal).
    return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  }

  await recordAiUsage(guard.userId, 'product-lookup', 0);
  return NextResponse.json(product);
}
