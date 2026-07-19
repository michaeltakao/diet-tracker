'use client';

/**
 * Month calendar with per-day category dots (phase C).
 *
 * A day shows up to 4 dots — meal / exercise / vital / symptom — colored by
 * CATEGORY_META.ring, from the same per-category date-set derivation as
 * lib/dashboard-data.ts. Tapping a day hands the date to the parent, which
 * reuses the weekly view's selected-day rendering.
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthGrid, shiftMonth } from '@/lib/calendar';
import { jstToday } from '@/lib/streak';
import { CATEGORY_KEYS, type CategoryKey } from '@/lib/dashboard-data';
import { CATEGORY_META } from '@/components/dashboard/category-meta';
import { useLanguage } from '@/contexts/LanguageContext';

export interface MonthCalendarProps {
  /** Per-category sets of YYYY-MM-DD days with at least one entry. */
  daySets: Record<CategoryKey, ReadonlySet<string>>;
  onSelectDay: (date: string) => void;
}

const DOW_JA = ['月', '火', '水', '木', '金', '土', '日'];
const DOW_EN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function MonthCalendar({ daySets, onSelectDay }: MonthCalendarProps) {
  const { lang } = useLanguage();
  const today = jstToday();
  const [ym, setYm] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }));

  const weeks = monthGrid(ym.year, ym.month);
  const monthPrefix = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
  const monthLabel = lang === 'ja'
    ? `${ym.year}年${ym.month}月`
    : new Date(`${monthPrefix}-01T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  const dows = lang === 'ja' ? DOW_JA : DOW_EN;

  return (
    <div className="bg-card rounded-2xl shadow-card border border-line p-4 mb-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setYm((v) => shiftMonth(v.year, v.month, -1))}
          aria-label={lang === 'ja' ? '前の月' : 'Previous month'}
          className="p-2 rounded-xl text-faint hover:bg-surface-2 active:scale-90 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <span className="text-sm font-bold text-muted">{monthLabel}</span>
        <button
          onClick={() => setYm((v) => shiftMonth(v.year, v.month, 1))}
          aria-label={lang === 'ja' ? '次の月' : 'Next month'}
          className="p-2 rounded-xl text-faint hover:bg-surface-2 active:scale-90 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {dows.map((d) => (
          <span key={d} className="text-center text-[10px] font-black text-faint uppercase">{d}</span>
        ))}
      </div>

      {/* Grid */}
      <div className="space-y-1">
        {weeks.map((week) => (
          <div key={week[0]} className="grid grid-cols-7 gap-1">
            {week.map((date) => {
              const inMonth = date.startsWith(monthPrefix);
              const isToday = date === today;
              const dots = CATEGORY_KEYS.filter((k) => daySets[k].has(date));
              return (
                <button
                  key={date}
                  onClick={() => onSelectDay(date)}
                  aria-label={date}
                  className={`
                    flex flex-col items-center gap-0.5 py-1.5 rounded-xl
                    transition-all duration-150 active:scale-95
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                    ${isToday ? 'bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-400' : 'hover:bg-surface-2'}
                  `}
                >
                  <span className={`text-xs font-bold tabular-nums ${inMonth ? 'text-fg' : 'text-faint/50'}`}>
                    {Number(date.slice(8, 10))}
                  </span>
                  <span className="flex gap-0.5 h-1.5" aria-hidden="true">
                    {dots.map((k) => (
                      <span
                        key={k}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: CATEGORY_META[k].ring, opacity: inMonth ? 1 : 0.35 }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
