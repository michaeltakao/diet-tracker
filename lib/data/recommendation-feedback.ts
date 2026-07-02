/**
 * Recommendation feedback data access (Phase B: preference model).
 *
 * Read/write: localStorage (synchronous). Cloud dual-write to the
 * `recommendation_feedback` table (migration 005) is intentionally deferred until
 * lib/database.types.ts is regenerated against that table, so the typed Supabase
 * client stays sound. See lib/data/_write.ts for the dual-write pattern to follow
 * once types exist.
 *
 * Pages must import these from '@/lib/data' (ADR-006), never from '@/lib/storage'.
 */

export {
  getRecommendationFeedback,
  addRecommendationFeedback,
  clearRecommendationFeedback,
} from '@/lib/storage';
