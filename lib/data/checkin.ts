/**
 * Daily check-in persistence.
 * Writes to localStorage immediately; syncs to Supabase when authenticated.
 */

import type { DailyCheckIn } from '@/lib/types';
import { safeParse } from '@/lib/json';
import { todayLocal } from '@/lib/format-date';
import { getWriteContext } from './_write';

const KEY = 'diet-tracker-checkins';

function getAll(): Record<string, DailyCheckIn> {
  if (typeof window === 'undefined') return {};
  return safeParse<Record<string, DailyCheckIn>>(localStorage.getItem(KEY), {});
}

function saveAll(data: Record<string, DailyCheckIn>): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getCheckIn(date: string): DailyCheckIn | null {
  return getAll()[date] ?? null;
}

export async function saveCheckIn(checkIn: DailyCheckIn): Promise<void> {
  // 1. localStorage — always, synchronous
  const all = getAll();
  all[checkIn.date] = checkIn;
  saveAll(all);

  // 2. Supabase — only when authenticated
  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase
    .from('checkins')
    .upsert(
      {
        user_id:        ctx.userId,
        logged_date:    checkIn.date,
        mood:           checkIn.mood,
        energy:         checkIn.energy,
        sleep_hours:    checkIn.sleepHours,
        soreness_areas: checkIn.sorenessAreas,
        notes:          checkIn.notes ?? null,
      },
      { onConflict: 'user_id,logged_date' },
    );

  if (error) console.warn('[data/checkin] Supabase upsert failed:', error.message);
}

export function getRecentCheckIns(days = 7): DailyCheckIn[] {
  const all = getAll();
  return Object.values(all)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, days);
}

/** Today's local-time `YYYY-MM-DD`. Thin alias over the shared helper. */
export function todayDate(): string {
  return todayLocal();
}
