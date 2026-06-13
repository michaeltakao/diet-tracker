/**
 * Daily medication check-in persistence.
 * Stored in localStorage under MED_LOG_KEY.
 * Keeps last 30 days of entries.
 */

import type { MedLogEntry } from '@/lib/types';
import { safeParse } from '@/lib/json';
import { todayLocal } from '@/lib/format-date';

const MED_LOG_KEY = 'diet-tracker-med-log';
const MAX_DAYS = 30;

function todayStr(): string {
  return todayLocal();
}

function loadAll(): MedLogEntry[] {
  if (typeof window === 'undefined') return [];
  return safeParse<MedLogEntry[]>(localStorage.getItem(MED_LOG_KEY), []);
}

function saveAll(entries: MedLogEntry[]): void {
  if (typeof window === 'undefined') return;
  // Keep only the most recent MAX_DAYS entries
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_DAYS);
  localStorage.setItem(MED_LOG_KEY, JSON.stringify(sorted));
}

export function getTodayMedLog(): MedLogEntry {
  const today = todayStr();
  const all = loadAll();
  return all.find(e => e.date === today) ?? { date: today, takenMeds: [] };
}

export function markMedTaken(medName: string): void {
  const today = todayStr();
  const all = loadAll();
  const idx = all.findIndex(e => e.date === today);
  if (idx >= 0) {
    if (!all[idx].takenMeds.includes(medName)) {
      all[idx].takenMeds = [...all[idx].takenMeds, medName];
    }
  } else {
    all.push({ date: today, takenMeds: [medName] });
  }
  saveAll(all);
}

export function markMedNotTaken(medName: string): void {
  const today = todayStr();
  const all = loadAll();
  const idx = all.findIndex(e => e.date === today);
  if (idx >= 0) {
    all[idx].takenMeds = all[idx].takenMeds.filter(m => m !== medName);
    saveAll(all);
  }
}

export function getMedLogHistory(days = 7): MedLogEntry[] {
  const all = loadAll();
  return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, days);
}
