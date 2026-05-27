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
