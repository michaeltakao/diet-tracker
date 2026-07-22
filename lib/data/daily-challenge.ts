/**
 * Daily challenge completion tracking — localStorage read + Supabase
 * dual-write. Same pattern as lib/data/quests.ts: a small self-resetting
 * per-day record in its own storage key; rolling to a new JST day naturally
 * starts fresh (old-date blobs are ignored, not migrated).
 *
 * XP is granted via lib/xp.ts addXp(); the completion row mirrors to
 * Supabase `user_challenges` (idempotent upsert on (user_id,
 * challenge_date)).
 */

import { getWriteContext } from './_write';
import { addXp } from '@/lib/xp';
import { DAILY_CHALLENGE_XP, type ChallengeDef, type ChallengeType } from '@/lib/daily-challenge';

const CHALLENGE_STORAGE_KEY = 'diet-tracker-daily-challenge-v1';

interface ChallengeStateBlob {
  date: string;
  challengeType: ChallengeType;
  completed: boolean;
}

function readBlob(): ChallengeStateBlob | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CHALLENGE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ChallengeStateBlob;
  } catch {
    return null;
  }
}

function writeBlob(blob: ChallengeStateBlob): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CHALLENGE_STORAGE_KEY, JSON.stringify(blob));
  } catch {
    // storage unavailable — challenge completion simply won't persist this session
  }
}

/** Whether today's challenge is already recorded complete (false after day rollover). */
export function isChallengeCompletedToday(today: string): boolean {
  const blob = readBlob();
  return blob !== null && blob.date === today && blob.completed;
}

/**
 * Record today's challenge as completed: mark it locally, grant the XP
 * (lib/xp.ts addXp — localStorage + Supabase dual-write), and mirror the
 * row to Supabase `user_challenges` (idempotent upsert on (user_id,
 * challenge_date) — a retry never double-records the day, though addXp()
 * itself has no such guard: callers MUST pre-check
 * isChallengeCompletedToday() before invoking, same contract as
 * recordQuestCompletion).
 *
 * `userId` is kept for symmetry with addXp() but not used to gate the
 * Supabase leg — see lib/xp.ts's addXp doc comment for why.
 */
export async function recordChallengeCompletion(
  userId: string | null,
  today: string,
  def: ChallengeDef,
): Promise<void> {
  writeBlob({ date: today, challengeType: def.type, completed: true });

  await addXp(userId, 'daily_challenge', DAILY_CHALLENGE_XP);

  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase.from('user_challenges').upsert(
    {
      user_id: ctx.userId,
      challenge_date: today,
      challenge_type: def.type,
      xp_earned: DAILY_CHALLENGE_XP,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,challenge_date' },
  );

  if (error) {
    console.warn('[data/daily-challenge] Supabase recordChallengeCompletion failed:', error.message);
  }
}
