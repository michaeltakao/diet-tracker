/**
 * Supabase browser client singleton.
 *
 * Use this in Client Components ('use client') and anywhere that runs in the browser.
 * Creates a new client instance per call but the underlying connection is reused.
 *
 * Usage:
 *   import { createClient } from '@/lib/supabase';
 *   const supabase = createClient();
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

/**
 * Returns true when NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are real credentials.
 * Returns false when they contain placeholder/xxxx values or are missing.
 *
 * Exported here (not in contexts/) so lib/data/* can import it without
 * creating a circular dependency through ProfileContext.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return url.length > 0
    && !url.includes('placeholder')
    && !url.includes('xxxx')
    && key.length > 0
    && !key.includes('placeholder');
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Get the current authenticated user from the browser client.
 * Returns null if not authenticated.
 *
 * Note: uses getUser() (server-validated) not getSession() (client-only).
 */
export async function getCurrentUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
