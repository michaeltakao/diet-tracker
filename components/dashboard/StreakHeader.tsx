'use client';

/**
 * Duolingo-style streak banner + stats pill (design phase 5, from the v0
 * mock's streak-header). Fox-orange banner with dark-brown text
 * (--fox-text — white on fox fails AA at 2.18:1); the white flame chip is
 * decorative. The v0 mock's gems→earned-badge count and hearts→weekly
 * streak-repair ticket (0/1), per the 2026-07-17 decisions.
 */

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { getDashboardStats, type DashboardStats } from '@/lib/dashboard-data';
import { useLanguage } from '@/contexts/LanguageContext';

export function StreakHeader() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    setStats(getDashboardStats());
  }, []);

  if (!stats) return null;

  return (
    <section aria-label={t.streak} className="mb-3 flex flex-col gap-3">
      {/* Fox streak banner */}
      <div className="flex items-center gap-4 rounded-2xl bg-fox p-4 shadow-[0_4px_0_var(--fox-dark)]">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/25">
          <Flame className="size-8 fill-white text-white" aria-hidden="true" />
        </div>
        <div className="flex-1 text-fox-text">
          <p className="text-xs font-bold">{t.streak}</p>
          {stats.streak > 0 ? (
            <p className="text-3xl font-black leading-tight tabular-nums">
              {t.streakBannerDays.replace('{n}', String(stats.streak))}
            </p>
          ) : (
            <p className="text-base font-extrabold leading-snug">{t.streakBannerStart}</p>
          )}
        </div>
        {stats.streak > 0 && (
          <div className="flex shrink-0 flex-col items-center rounded-xl bg-white/25 px-3 py-2 text-fox-text">
            <span className="text-lg" aria-hidden="true">🔥</span>
            <span className="text-xs font-extrabold">{t.streakBannerActive}</span>
          </div>
        )}
      </div>

      {/* Stats pill: earned badges + weekly repair ticket */}
      <div className="flex items-center justify-center gap-6 rounded-2xl border border-line bg-card px-4 py-2.5 shadow-card">
        <div className="flex items-center gap-1.5">
          <span className="text-lg" aria-hidden="true">🏅</span>
          <div className="flex flex-col leading-none">
            <span className="text-base font-extrabold text-fg tabular-nums">{stats.badgeCount}</span>
            <span className="text-[11px] font-bold text-faint">{t.statBadges}</span>
          </div>
        </div>
        <span className="h-6 w-px bg-line" aria-hidden="true" />
        <div className="flex items-center gap-1.5">
          <span className="text-lg" aria-hidden="true">❤️</span>
          <div className="flex flex-col leading-none">
            <span className="text-base font-extrabold text-fg tabular-nums">
              {stats.repairAvailable ? 1 : 0}/1
            </span>
            <span className="text-[11px] font-bold text-faint">{t.statRepair}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
