/**
 * Data export / import utilities for Diet Tracker.
 *
 * All data lives in localStorage under 'diet-tracker-v1'.
 * These helpers let users download a full backup and restore from one,
 * acting as a manual sync mechanism until Supabase is integrated.
 */

import { AppData } from './types';
import { getAppData, saveAppData } from './storage';

const STORAGE_KEY = 'diet-tracker-v1';

export interface ExportPayload {
  version: string;           // schema version
  exportedAt: string;        // ISO timestamp
  data: AppData;
}

// ── Storage stats ────────────────────────────────────────────

export interface StorageStats {
  usedBytes: number;
  usedKB: string;
  foodCount: number;
  workoutCount: number;
  weightCount: number;
  badgeCount: number;
  daysTracked: number;
}

export function getStorageStats(): StorageStats {
  if (typeof window === 'undefined') {
    return { usedBytes: 0, usedKB: '0', foodCount: 0, workoutCount: 0, weightCount: 0, badgeCount: 0, daysTracked: 0 };
  }

  const raw = localStorage.getItem(STORAGE_KEY) ?? '';
  const usedBytes = new Blob([raw]).size;
  const data = getAppData();
  const trackedDates = new Set([
    ...data.foodEntries.map((e) => e.date),
    ...data.workoutEntries.map((e) => e.date),
    ...data.weightEntries.map((e) => e.date),
  ]);

  return {
    usedBytes,
    usedKB: (usedBytes / 1024).toFixed(1),
    foodCount:    data.foodEntries.length,
    workoutCount: data.workoutEntries.length,
    weightCount:  data.weightEntries.length,
    badgeCount:   (data.badges ?? []).length,
    daysTracked:  trackedDates.size,
  };
}

// ── Export ───────────────────────────────────────────────────

export function exportDataAsJSON(): void {
  if (typeof window === 'undefined') return;

  const payload: ExportPayload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    data: getAppData(),
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `diet-tracker-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportDataAsCSV(): void {
  if (typeof window === 'undefined') return;

  const data = getAppData();

  const rows: string[] = [
    'type,date,name,calories,protein,fat,carbs,mealType,weight,sets,reps',
  ];

  for (const e of data.foodEntries) {
    rows.push(`food,${e.date},"${e.name.replace(/"/g, '""')}",${e.calories},${e.protein},${e.fat},${e.carbs},${e.mealType},,, `);
  }

  for (const w of data.workoutEntries) {
    rows.push(`workout,${w.date},"${w.name.replace(/"/g, '""')}",,,,,, ${w.weight ?? ''},${w.sets ?? ''},${w.reps ?? ''}`);
  }

  for (const wt of data.weightEntries) {
    rows.push(`weight,${wt.date},,,,,,, ${wt.weight},,`);
  }

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `diet-tracker-export-${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Import ───────────────────────────────────────────────────

export type ImportResult =
  | { success: true;  stats: StorageStats }
  | { success: false; error: string };

export async function importFromFile(file: File): Promise<ImportResult> {
  if (typeof window === 'undefined') return { success: false, error: 'Not in browser' };

  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<ExportPayload>;

    if (!parsed.data) {
      return { success: false, error: 'Invalid backup file: missing data field.' };
    }

    const incoming = parsed.data as AppData;

    // Merge strategy: merge arrays by id, keeping most recent
    const current = getAppData();

    const mergeById = <T extends { id: string }>(a: T[], b: T[]): T[] => {
      const map = new Map<string, T>();
      [...a, ...b].forEach((item) => map.set(item.id, item));
      return Array.from(map.values());
    };

    const merged: AppData = {
      foodEntries:    mergeById(current.foodEntries,    incoming.foodEntries    ?? []),
      workoutEntries: mergeById(current.workoutEntries, incoming.workoutEntries ?? []),
      weightEntries:  mergeById(current.weightEntries,  incoming.weightEntries  ?? []),
      goals: incoming.goals ?? current.goals,
      waterByDate: { ...current.waterByDate, ...(incoming.waterByDate ?? {}) },
      badges:          mergeById(current.badges ?? [],  incoming.badges         ?? []),
      personalRecords: { ...current.personalRecords, ...(incoming.personalRecords ?? {}) },
      // Keyed by (itemType, itemName) rather than id; incoming wins on conflict.
      recommendationFeedback: Array.from(
        new Map(
          [
            ...(current.recommendationFeedback ?? []),
            ...(incoming.recommendationFeedback ?? []),
          ].map((f) => [`${f.itemType}:${f.itemName}`, f] as const),
        ).values(),
      ),
    };

    saveAppData(merged);
    return { success: true, stats: getStorageStats() };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown import error',
    };
  }
}

// ── Clear all data ───────────────────────────────────────────

export function clearAllData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
