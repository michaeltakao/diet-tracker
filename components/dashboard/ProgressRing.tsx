'use client';

/**
 * 4-segment daily progress ring (design phase 5, ported from the v0 mock).
 * Each quarter segment is one category (meal / exercise / vital / symptom)
 * and is binary: filled when at least one entry of that category was logged
 * today (JST). Center shows the overall percentage (n/4 × 100).
 *
 * A11y: the SVG is role="img" with the real percentage in its label; the
 * legend glyphs (✓/–) are visible text, and segment colors are decorative.
 */

import { useEffect, useState } from 'react';
import { getDashboardStats, type DashboardCategoryStats } from '@/lib/dashboard-data';
import { CATEGORY_META } from './category-meta';
import { useLanguage } from '@/contexts/LanguageContext';
import { jstToday } from '@/lib/streak';
import { hasCelebrated, markCelebrated } from '@/lib/celebrate-once';

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 96;
const STROKE = 18;
const CIRC = 2 * Math.PI * RADIUS;
const GAP = 14; // arc length between segments
const SEGMENT = CIRC / 4 - GAP;

export function ProgressRing() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardCategoryStats | null>(null);
  const [justCelebrated, setJustCelebrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    setStats(getDashboardStats());
  }, []);

  // Phase 6: pop the center text once per day on the false→true 100% transition.
  // Guarded by localStorage (not just component state) so a reload right after
  // hitting 100% doesn't re-trigger the pop animation.
  useEffect(() => {
    if (!stats || stats.todayPct < 100) return;
    const key = `diet-tracker-ring-celebrated:${jstToday()}`;
    if (hasCelebrated(key)) return;
    markCelebrated(key);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot celebration flag driven by a localStorage guard, not re-derivable from props/state
    setJustCelebrated(true);
  }, [stats]);

  if (!stats) return null;

  const done = stats.todayPct >= 100;

  return (
    <section
      aria-label={t.ringTitle}
      className="mb-3 flex flex-col items-center rounded-2xl border border-line bg-card p-4 shadow-card"
    >
      <div className="flex w-full items-center justify-between">
        <h2 className="text-sm font-bold text-muted">{t.ringTitle}</h2>
        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-extrabold text-brand-strong">
          {done ? `${t.ringDone} 🎉` : t.ringKeepGoing}
        </span>
      </div>

      <div className="relative my-4" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="-rotate-90"
          role="img"
          aria-label={t.ringAria.replace('{n}', String(stats.todayPct))}
        >
          {stats.categories.map((c, i) => {
            const rotation = (i * CIRC) / 4;
            return (
              <g key={c.key}>
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS}
                  fill="none"
                  stroke="var(--surface-2)"
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${SEGMENT} ${CIRC - SEGMENT}`}
                  strokeDashoffset={-rotation}
                />
                {/* Binary fill: whole segment or nothing (a 0-length round-cap
                    dash still paints a dot, so skip it entirely). */}
                {c.loggedToday && (
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    fill="none"
                    stroke={CATEGORY_META[c.key].ring}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={`${SEGMENT} ${CIRC - SEGMENT}`}
                    strokeDashoffset={-rotation}
                  />
                )}
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`text-5xl font-black text-fg tabular-nums ${justCelebrated ? 'animate-badge-pop' : ''}`}
          >
            {stats.todayPct}%
          </span>
          <span className="text-xs font-bold text-muted">{t.ringAchieved}</span>
        </div>
      </div>

      {/* Legend */}
      <ul className="grid w-full grid-cols-2 gap-2">
        {stats.categories.map((c) => {
          const meta = CATEGORY_META[c.key];
          const Icon = meta.icon;
          return (
            <li key={c.key} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: meta.ring }}
              >
                <Icon className="size-4 text-white" aria-hidden="true" />
              </span>
              <span className="flex-1 text-sm font-bold text-fg">{t[meta.labelKey]}</span>
              <span
                className={`text-sm font-extrabold ${c.loggedToday ? 'text-success' : 'text-faint'}`}
              >
                {c.loggedToday ? '✓' : '–'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
