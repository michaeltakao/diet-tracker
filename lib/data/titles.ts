/**
 * Title data access layer.
 *
 * Read: localStorage always (synchronous, immediate) — earnedTitles lives
 * in the synced AppData blob (like badges), since titles are once-earned-
 * never-revoked, unlike quests' self-resetting-per-day state.
 * Write: lib/titles.ts's awardTitle() (localStorage first, then Supabase).
 */

import { getAppData } from '@/lib/storage';
import type { TitleKey } from '@/lib/titles';

/** Set of title keys already earned, read from the local AppData blob. */
export function getEarnedTitleKeys(): Set<TitleKey> {
  return new Set((getAppData().earnedTitles ?? []) as TitleKey[]);
}
