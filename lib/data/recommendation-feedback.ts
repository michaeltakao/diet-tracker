/**
 * Recommendation feedback data access (Phase B: preference model).
 *
 * Read:  localStorage always (synchronous, immediate).
 * Write: localStorage first; then Supabase `recommendation_feedback`
 *        (migration 005) when authenticated — async, fire-and-forget,
 *        same pattern as lib/data/health-profile.ts.
 *
 * clearRecommendationFeedback stays localStorage-only on purpose: cloud
 * feedback history is research data (same rationale as unfavorite keeping
 * feedback history, see lib/data/favorites.ts).
 *
 * Pages must import these from '@/lib/data' (ADR-006), never from '@/lib/storage'.
 */

import { addRecommendationFeedback as _add } from '@/lib/storage';
import { getWriteContext } from './_write';
import type { RecommendationFeedback } from '@/lib/types';

export {
  getRecommendationFeedback,
  clearRecommendationFeedback,
} from '@/lib/storage';

export function addRecommendationFeedback(feedback: RecommendationFeedback): void {
  _add(feedback);

  // Dual-write to Supabase (fire-and-forget)
  void (async () => {
    const ctx = await getWriteContext();
    if (!ctx) return;
    const { error } = await ctx.supabase.from('recommendation_feedback').upsert({
      id: feedback.id,
      user_id: ctx.userId,
      client_id: feedback.id, // local record id (column NOT NULL; lib/migrate.ts convention)
      item_type: feedback.itemType,
      item_name: feedback.itemName,
      kind: feedback.kind,
      macro_highlight: feedback.macroHighlight ?? null,
      category: feedback.category ?? null,
      created_at: feedback.createdAt,
      // Conflict target must match the table's UNIQUE(user_id, item_type,
      // item_name): latest-wins, mirroring the localStorage dedup in
      // lib/storage.ts — an id-based upsert would 23505 on repeat feedback.
    }, { onConflict: 'user_id,item_type,item_name' });
    if (error) console.warn('[data/recommendation-feedback] Supabase upsert failed:', error.message);
  })();
}
