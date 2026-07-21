'use client';

/**
 * 2×2 per-category weekly badge grid (design phase 5, from the v0 mock).
 * Each tile shows distinct logged days this JST Mon–Sun week (n/7) with a
 * mini progress bar; the ⭐ chip is earned at the real weekly-challenge
 * threshold (WEEKLY_GOAL_DAYS), not the mock's rate ≥ 90.
 *
 * Different concept from BadgeShelf (earned achievement badges) — this is
 * a live per-category habit meter.
 */

import { useEffect, useState } from 'react';
import { WEEKLY_GOAL_DAYS } from '@/lib/data';
import { getDashboardStats, type DashboardCategoryStats } from '@/lib/dashboard-data';
import { CATEGORY_META } from './category-meta';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useLanguage } from '@/contexts/LanguageContext';
import { jstToday, isoWeekKey } from '@/lib/streak';
import { hasCelebrated, markCelebrated } from '@/lib/celebrate-once';

export function CategoryBadges() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardCategoryStats | null>(null);
  const [justEarned, setJustEarned] = useState<Set<string>>(new Set());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    setStats(getDashboardStats());
  }, []);

  // Phase 6: pop the ⭐ chip once per category per ISO week, on first render
  // where that category has crossed WEEKLY_GOAL_DAYS. Guarded by localStorage
  // (not just component state) so a reload after earning doesn't re-pop.
  useEffect(() => {
    if (!stats) return;
    const week = isoWeekKey(jstToday());
    const newlyEarned = new Set<string>();
    for (const c of stats.categories) {
      if (c.weekDays < WEEKLY_GOAL_DAYS) continue;
      const key = `diet-tracker-category-celebrated:${week}:${c.key}`;
      if (hasCelebrated(key)) continue;
      markCelebrated(key);
      newlyEarned.add(c.key);
    }
    if (newlyEarned.size > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot celebration flags driven by a localStorage guard, not re-derivable from props/state
      setJustEarned(newlyEarned);
    }
  }, [stats]);

  if (!stats) return null;

  return (
    <section aria-label={t.categoryBadgesTitle} className="mb-3">
      <h2 className="mb-3 mt-1 text-sm font-bold text-muted">{t.categoryBadgesTitle}</h2>
      <ul className="grid grid-cols-2 gap-3">
        {stats.categories.map((c) => {
          const meta = CATEGORY_META[c.key];
          const Icon = meta.icon;
          const earned = c.weekDays >= WEEKLY_GOAL_DAYS;
          return (
            <li key={c.key}>
              <Card className="flex flex-col items-center gap-2 p-4 text-center">
                <div
                  className="relative flex size-14 items-center justify-center rounded-full"
                  style={{ backgroundColor: meta.ring }}
                >
                  <Icon className="size-7 text-white" aria-hidden="true" />
                  {earned && (
                    <span
                      className={`absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-warning-soft text-xs shadow-[0_2px_0_rgba(0,0,0,0.12)] ${justEarned.has(c.key) ? 'animate-badge-pop' : ''}`}
                      aria-label={t.ringDone}
                    >
                      ⭐
                    </span>
                  )}
                </div>
                <p className="text-sm font-extrabold text-fg">{t[meta.labelKey]}</p>
                <ProgressBar
                  value={c.weekDays}
                  max={7}
                  variant={meta.barVariant}
                  ariaLabel={`${t[meta.labelKey]} ${c.weekDays}/7${t.streakDays}`}
                />
                <p className="text-xs font-bold text-faint tabular-nums">
                  {c.weekDays}/7{t.streakDays}
                </p>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
