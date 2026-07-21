/**
 * Daily quest completion tracking — localStorage read + Supabase dual-write.
 *
 * Completion state is NOT part of the synced AppData blob (unlike badges/
 * weight/etc.) — it's a small, self-resetting per-day record, own storage
 * key `diet-tracker-quests-v1`. Rolling to a new JST day naturally starts a
 * fresh empty set (old-date records are simply ignored, not migrated),
 * mirroring the daily-quest system's "resets every day" semantics.
 *
 * XP is granted via lib/xp.ts addXp() — same idiom as lib/data/badges.ts
 * delegating to lib/storage.ts, except quests own their persistence here
 * directly since there is no pure-storage.ts counterpart for quests.
 */

import { getWriteContext } from './_write';
import { addXp } from '@/lib/xp';
import type { Quest, QuestType } from '@/lib/daily-quests';

const QUEST_STORAGE_KEY = 'diet-tracker-quests-v1';

interface QuestStateBlob {
  date: string;
  completed: QuestType[];
}

function readBlob(): QuestStateBlob | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(QUEST_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as QuestStateBlob;
  } catch {
    return null;
  }
}

function writeBlob(blob: QuestStateBlob): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(blob));
  } catch {
    // storage unavailable — quest completion simply won't persist this session
  }
}

/** Set of quest types already recorded complete for `today` (empty if the stored date has rolled over). */
export function getTodayQuestState(today: string): Set<QuestType> {
  const blob = readBlob();
  if (!blob || blob.date !== today) return new Set();
  return new Set(blob.completed);
}

/**
 * Record a newly-completed quest: mark it done for today (localStorage),
 * grant its XP (lib/xp.ts addXp — localStorage + Supabase dual-write), and
 * mirror the completion row to Supabase `user_quests` (idempotent upsert on
 * (user_id, quest_date, quest_type) — a retry never double-awards XP via
 * this row, though addXp() itself has no such guard: callers must only
 * invoke recordQuestCompletion for quests not already in getTodayQuestState()).
 *
 * `userId` param is kept for symmetry with addXp() but not used to gate the
 * Supabase leg — see lib/xp.ts's addXp doc comment for why.
 */
export async function recordQuestCompletion(
  userId: string | null,
  today: string,
  quest: Quest,
): Promise<void> {
  const current = getTodayQuestState(today);
  current.add(quest.type);
  writeBlob({ date: today, completed: Array.from(current) });

  await addXp(userId, `quest_${quest.type}` as const, quest.xp);

  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase.from('user_quests').upsert(
    {
      user_id: ctx.userId,
      quest_date: today,
      quest_type: quest.type,
      completed: true,
      completed_at: new Date().toISOString(),
      xp_earned: quest.xp,
    },
    { onConflict: 'user_id,quest_date,quest_type' },
  );

  if (error) {
    console.warn('[data/quests] Supabase recordQuestCompletion failed:', error.message);
  }
}
