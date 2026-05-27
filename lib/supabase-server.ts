/**
 * Supabase server client factory.
 *
 * Use this in:
 *   - Route Handlers (app/api/[route]/route.ts)
 *   - Server Components
 *   - Server Actions
 *
 * Creates a new client per request, using Next.js cookies() for session management.
 * The @supabase/ssr package handles cookie refresh automatically.
 *
 * Usage:
 *   import { createServerSupabase } from '@/lib/supabase-server';
 *   const supabase = await createServerSupabase();
 *   const { data: { user } } = await supabase.auth.getUser();
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component — cookies are read-only.
            // This is expected behaviour; session refresh happens in middleware.
          }
        },
      },
    },
  );
}

/**
 * Server-side service role client for privileged operations
 * (e.g., writing badges from server-side badge checks).
 *
 * NEVER expose this client to the browser.
 * NEXT_PUBLIC_ prefix is intentionally absent on SUPABASE_SERVICE_ROLE_KEY.
 */
export async function createServiceSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch { /* read-only context */ }
        },
      },
    },
  );
}

/**
 * Convenience: get the authenticated user from a server context.
 * Returns null if not authenticated (never throws).
 */
export async function getServerUser() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}
