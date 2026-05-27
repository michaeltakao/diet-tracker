/**
 * Full AppData accessor — compatibility shim.
 *
 * Re-exports getAppData() from lib/storage so that page components
 * can import from '@/lib/data' instead of '@/lib/storage' directly.
 * This satisfies ADR-006: no page may import from lib/storage.
 *
 * STEP 7 change: replace with Supabase read after migration runs.
 * STEP 9 change: individual entity reads replace getAppData() entirely.
 *
 * See: docs/decisions/ADR-006-data-abstraction.md
 */

export { getAppData } from '@/lib/storage';
