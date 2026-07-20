/**
 * Daily check-in persistence.
 * Writes to localStorage immediately; syncs to Supabase when authenticated.
 */

import type { DailyCheckIn } from '@/lib/types';
import { getWriteContext } from './_write';

const KEY = 'diet-tracker-checkins';

function getAll(): Record<string, DailyCheckIn> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, DailyCheckIn>) : {};
  } catch {
    return {};
  }
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
        sleep_quality:  checkIn.sleepQuality ?? null,
        stress_level:   checkIn.stressLevel ?? null,
        bed_time:       checkIn.bedTime ?? null,
        wake_time:      checkIn.wakeTime ?? null,
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

export function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
