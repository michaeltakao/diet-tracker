'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getAppData } from '@/lib/data';
import { useLanguage } from '@/contexts/LanguageContext';

// Pages that already show a full calorie breakdown
const HIDDEN_PATHS = new Set(['/', '/settings']);

interface Snapshot {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  goal: number;
}

const ZERO: Snapshot = { calories: 0, protein: 0, fat: 0, carbs: 0, goal: 2000 };

function readSnapshot(): Snapshot {
  try {
    const data = getAppData();
    const today = new Date().toISOString().split('T')[0];
    const entries = data.foodEntries.filter((e) => e.date === today);
    const agg = entries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein:  acc.protein  + e.protein,
        fat:      acc.fat      + e.fat,
        carbs:    acc.carbs    + e.carbs,
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 },
    );
    return { ...agg, goal: data.goals.calories };
  } catch {
    return ZERO;
  }
}

export default function CalorieContextBar() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [snap, setSnap] = useState<Snapshot>(ZERO);

  useEffect(() => {
    setSnap(readSnapshot());
    const onFocus = () => setSnap(readSnapshot());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [pathname]);

  if (HIDDEN_PATHS.has(pathname)) return null;
  // hide if user has never set goals or logged anything
  if (snap.goal === 2000 && snap.calories === 0) return null;

  const remaining = snap.goal - snap.calories;
  const over = remaining < 0;
  const pct = snap.goal > 0 ? Math.min((snap.calories / snap.goal) * 100, 100) : 0;

  // Backgrounds are deliberately dark enough for AA white text in both themes.
  const bgClass = over
    ? 'bg-red-600'
    : pct > 85
    ? 'bg-amber-700'
    : 'bg-emerald-600';

  return (
    <div
      role="status"
      className={`relative overflow-hidden ${bgClass} select-none`}
      style={{ height: 36 }}
    >
      {/* progress tint */}
      <div
        className="absolute inset-y-0 left-0 bg-black/10 transition-[width] duration-700"
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      />

      <div className="relative h-full flex items-center justify-between px-4 gap-3">
        {/* left: remaining / over */}
        <span className="text-white text-xs font-black tabular-nums shrink-0">
          {over
            ? `+${Math.abs(remaining).toLocaleString()} kcal ${t.caloriesOver}`
            : `${remaining.toLocaleString()} kcal ${t.remaining}`}
        </span>

        {/* right: macro pills */}
        <div className="flex items-center gap-2.5 text-white text-[11px] font-bold tabular-nums">
          <span>P {Math.round(snap.protein)}g</span>
          <span className="text-white/50" aria-hidden="true">·</span>
          <span>F {Math.round(snap.fat)}g</span>
          <span className="text-white/50" aria-hidden="true">·</span>
          <span>C {Math.round(snap.carbs)}g</span>
        </div>
      </div>
    </div>
  );
}
