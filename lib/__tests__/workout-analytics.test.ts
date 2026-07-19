import { describe, it, expect } from 'vitest';
import { volumeByBodyPart, exerciseProgressSeries, weightedExerciseNames } from '@/lib/workout-analytics';
import type { WorkoutEntry } from '@/lib/types';

function entry(partial: Partial<WorkoutEntry> & Pick<WorkoutEntry, 'date' | 'name'>): WorkoutEntry {
  return {
    id: partial.date + partial.name,
    category: 'strength',
    addedAt: `${partial.date}T10:00:00.000Z`,
    ...partial,
  };
}

describe('volumeByBodyPart', () => {
  it('aggregates setDetails exactly and scalar entries as sets×reps×weight', () => {
    const entries = [
      entry({ date: '2026-07-13', name: 'ベンチプレス', musclePart: 'chest',
        setDetails: [{ weight: 60, reps: 10 }, { weight: 65, reps: 8 }] }), // 1120
      entry({ date: '2026-07-14', name: 'スクワット', musclePart: 'legs',
        sets: 3, reps: 8, weight: 50 }), // 1200 (scalar fallback)
      entry({ date: '2026-07-15', name: 'ダンベルフライ', musclePart: 'chest',
        sets: 3, reps: 12, weight: 10 }), // 360
    ];
    const v = volumeByBodyPart(entries, '2026-07-13', '2026-07-19');
    expect(v.chest).toBe(1480);
    expect(v.legs).toBe(1200);
    expect(v.back).toBe(0); // untrained parts present as 0
  });

  it('respects the date window and skips part-less entries', () => {
    const entries = [
      entry({ date: '2026-07-12', name: 'A', musclePart: 'back', sets: 3, reps: 10, weight: 40 }), // before window
      entry({ date: '2026-07-13', name: 'ランニング', sets: 1, reps: 1, weight: 100 }),            // no musclePart
    ];
    const v = volumeByBodyPart(entries, '2026-07-13', '2026-07-19');
    expect(Object.values(v).every((x) => x === 0)).toBe(true);
  });
});

describe('exerciseProgressSeries', () => {
  it('builds an ascending per-day series with top weight and best 1RM', () => {
    const entries = [
      entry({ date: '2026-07-15', name: 'ベンチプレス', sets: 3, reps: 10, weight: 60 }),
      entry({ date: '2026-07-13', name: 'ベンチプレス',
        setDetails: [{ weight: 55, reps: 10 }, { weight: 60, reps: 6 }], weight: 60, reps: 6, sets: 2 }),
      entry({ date: '2026-07-14', name: 'スクワット', sets: 3, reps: 8, weight: 80 }), // other exercise
    ];
    const s = exerciseProgressSeries(entries, 'ベンチプレス');
    expect(s.map((p) => p.date)).toEqual(['2026-07-13', '2026-07-15']); // ascending
    expect(s[0].topWeight).toBe(60);
    expect(s[0].est1RM).toBe(73.3); // 55×(1+10/30)=73.3 > 60×(1+6/30)=72
    expect(s[1].topWeight).toBe(60);
    expect(s[1].est1RM).toBe(80);   // 60×(1+10/30)
  });

  it('merges same-day duplicates by max and skips bodyweight-only days', () => {
    const entries = [
      entry({ date: '2026-07-13', name: 'X', sets: 3, reps: 10, weight: 40 }),
      entry({ date: '2026-07-13', name: 'X', sets: 3, reps: 5, weight: 50 }),
      entry({ date: '2026-07-14', name: 'X', sets: 3, reps: 15, weight: 0 }), // bodyweight → skipped
    ];
    const s = exerciseProgressSeries(entries, 'X');
    expect(s.length).toBe(1);
    expect(s[0].topWeight).toBe(50);
    expect(s[0].est1RM).toBe(58.3); // max(40×4/3=53.3, 50×(1+5/30)=58.3)
  });
});

describe('weightedExerciseNames', () => {
  it('lists distinct weighted exercises, most recent first', () => {
    const entries = [
      entry({ date: '2026-07-10', name: 'A', weight: 40, reps: 10, sets: 3 }),
      entry({ date: '2026-07-15', name: 'B', weight: 50, reps: 8, sets: 3 }),
      entry({ date: '2026-07-12', name: 'A', weight: 45, reps: 10, sets: 3 }),
      entry({ date: '2026-07-16', name: 'プランク', weight: 0, reps: 30, sets: 3 }), // bodyweight excluded
    ];
    expect(weightedExerciseNames(entries)).toEqual(['B', 'A']);
  });
});
