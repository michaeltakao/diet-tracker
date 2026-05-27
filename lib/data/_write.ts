/**
 * Internal helper for dual-write operations.
 *
 * NOT exported from lib/data/index.ts — internal use only.
 *
 * Usage in lib/data/*.ts write functions:
 *
 *   const ctx = await getWriteContext();
 *   if (ctx) {
 *     const { error } = await ctx.supabase.from('food_logs').insert(...);
 *     if (error) console.warn('[data/food] Supabase write failed:', error.message);
 *   }
 *
 * If ctx is null, Supabase is not configured or user is not authenticated.
 * In both cases the caller should proceed — localStorage write already succeeded.
 */

import { createClient, getCurrentUser, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Use ReturnType<typeof createClient> rather than SupabaseClient<Database>
 * to match the exact return type of createBrowserClient<Database> from @supabase/ssr.
 * Using SupabaseClient<Database> from @supabase/supabase-js can cause generics
 * resolution mismatches (insert/upsert payload resolves to never[]).
 */
export interface WriteContext {
  supabase: ReturnType<typeof createClient>;
  userId:   string;
}

/**
 * Returns a Supabase client + userId when:
 * 1. Supabase is configured (real credentials in env), AND
 * 2. A user is currently authenticated.
 *
 * Returns null in all other cases (guest mode, not logged in).
 */
export async function getWriteContext(): Promise<WriteContext | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    return { supabase: createClient(), userId: user.id };
  } catch {
    return null;
  }
}
