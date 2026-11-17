'use client';

/**
 * Trends pane for /log (?view=trends) — the Phase C research surface.
 *
 * The two study outcomes only (ADR-011): weight trend + goal projection and
 * calorie adherence, computed by the pure functions in lib/trends.ts.
 * TDEE, intake-vs-expenditure, training volume, vitals and macro-shortfall
 * sections were deleted. Recharts components load via next/dynamic so the
 * default weekly view stays light.
 */

import { todayJst } from '@/lib/format-date';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { TrendingDown, Scale, Target } from 'lucide-react';
import { getAllWeightEntries, getAllFoodEntries, getRealGoals } from '@/lib/data';
import {
  smoothWeightSeries,
  projectGoalDate,
  computeAdherenceSeries,
  lastNDates,
  WEIGHT_WINDOW_DAYS,
} from '@/lib/trends';
import { recordEvent } from '@/lib/telemetry';
import { useLanguage } from '@/contexts/LanguageContext';
import { CARD_CLASS } from '@/components/ui/Card';
import type { DailyGoals } from '@/lib/types';

function ChartSkeleton({ h = 190 }: { h?: number }) {
  return <div className="skeleton rounded-2xl w-full" style={{ height: h }} aria-hidden />;
}

const WeightTrendChart = dynamic(
  () => import('@/components/trends/WeightTrendChart').then(m => m.WeightTrendChart),
  { ssr: false, loading: () => <ChartSkeleton h={200} /> },
);
const AdherenceCard = dynamic(
  () => import('@/components/trends/AdherenceCard').then(m => m.AdherenceCard),
  { ssr: false, loading: () => <ChartSkeleton h={110} /> },
);
/** Same "today" convention as the rest of the app (lib/data date stamps). */
function getTodayDate(): string {
  return todayJst();
}

const BALANCE_WINDOW_DAYS = 14;

export function TrendsPanel() {
  const { t, lang } = useLanguage();

  // Local data loads once on mount (hydration-safe: this component is only
  // rendered client-side after the view toggle).
  const [loaded, setLoaded] = useState(false);
  const [weightEntries, setWeightEntries] = useState<Array<{ date: string; weight: number }>>([]);
  const [foodEntries, setFoodEntries] = useState<Array<{ date: string; calories: number }>>([]);
  // null = no real goals set → adherence sits behind a set-goals CTA.
  const [goals, setGoals] = useState<DailyGoals | null>(null);

  useEffect(() => {
    recordEvent('trends_viewed');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    setWeightEntries(getAllWeightEntries().map(e => ({ date: e.date, weight: e.weight })));
    setFoodEntries(getAllFoodEntries().map(e => ({ date: e.date, calories: e.calories })));
    setGoals(getRealGoals());
    setLoaded(true);
  }, []);

  const today = getTodayDate();

  const calorieLogs = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const e of foodEntries) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.calories);
    return [...byDate.entries()].map(([date, totalKcal]) => ({ date, totalKcal }));
  }, [foodEntries]);

  const axis = useMemo(() => lastNDates(today, BALANCE_WINDOW_DAYS), [today]);

  const recentWeights = useMemo(() => {
    const cutoff = lastNDates(today, WEIGHT_WINDOW_DAYS)[0];
    return weightEntries.filter(w => w.date >= cutoff);
  }, [weightEntries, today]);

  const weightSeries = useMemo(() => smoothWeightSeries(recentWeights), [recentWeights]);
  // goalWeight is only ever present when the user set it, so optional
  // chaining is enough here — no realness gate needed for the projection.
  const trend = useMemo(
    () => projectGoalDate(recentWeights, goals?.goalWeight ?? null),
    [recentWeights, goals?.goalWeight],
  );
  // Goal-relative series only exist against real goals (null otherwise).
  const adherence = useMemo(
    () => (goals ? computeAdherenceSeries(axis, calorieLogs, goals.calories) : null),
    [axis, calorieLogs, goals],
  );
  const loggedDaysInWindow = useMemo(
    () => calorieLogs.filter(l => l.date >= axis[0] && l.date <= axis[axis.length - 1]).length,
    [calorieLogs, axis],
  );

  if (!loaded) return <ChartSkeleton h={300} />;

  const hasAnyData = weightSeries.length >= 2 || loggedDaysInWindow > 0 || calorieLogs.length > 0;
  if (!hasAnyData) {
    return (
      <div className={`${CARD_CLASS} p-10 text-center`}>
        <p className="text-4xl mb-3" aria-hidden>📈</p>
        <p className="text-sm font-semibold text-faint">{t.trendsEmptyTitle}</p>
        <p className="text-xs text-faint mt-1">{t.trendsEmptyDesc}</p>
      </div>
    );
  }

  const weeklySlopeKg = trend ? Math.round(trend.slope * 7 * 100) / 100 : null;

  return (
    <div className="space-y-3">
      {/* ── Weight trend ── */}
      <section className={`${CARD_CLASS} p-4`}>
        <div className="flex items-center gap-2 mb-2">
          <Scale size={14} className="text-brand" aria-hidden />
          <h2 className="text-xs font-black text-faint uppercase tracking-widest">{t.trendsWeightTitle}</h2>
        </div>
        {weightSeries.length >= 2 ? (
          <>
            <WeightTrendChart
              series={weightSeries}
              goalWeight={goals?.goalWeight}
              trend={trend}
              labels={{ raw: t.trendsRawLabel, trend: t.trendsTrendLabel, goal: t.trendsGoalLabel, projection: t.trendsProjectionLabel }}
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {weeklySlopeKg != null && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <TrendingDown size={11} className="text-brand" aria-hidden />
                  {t.trendsSlopeLabel}: <b className="tabular-nums">{weeklySlopeKg > 0 ? '+' : ''}{weeklySlopeKg} kg</b>
                </span>
              )}
              {trend?.projectedGoalDate && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Target size={11} className="text-success" aria-hidden />
                  {t.trendsGoalEta}: <b>{trend.projectedGoalDate}</b>
                </span>
              )}
            </div>
            {trend && (
              <p className="text-xs text-faint mt-2">
                {t.predicted90d}: <b className="text-fg tabular-nums">{trend.predictedIn90Days} kg</b>
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-faint py-4 text-center">{t.trendsEmptyDesc}</p>
        )}
      </section>

      {/* ── Calorie adherence (goal-relative → needs real goals) ── */}
      <section className={`${CARD_CLASS} p-4`}>
        <h2 className="text-xs font-black text-faint uppercase tracking-widest mb-2">{t.trendsAdherenceTitle}</h2>
        {!(goals && adherence) ? (
          <div className="bg-surface-2 rounded-2xl p-5 text-center">
            <p className="text-2xl mb-2" aria-hidden="true">🎯</p>
            <p className="text-xs text-faint mb-3">{t.aiNeedsGoals}</p>
            <Link
              href="/onboarding"
              className="
                inline-flex items-center justify-center
                px-4 py-2 rounded-xl
                bg-gradient-to-br from-brand-500 to-brand-600 text-white
                text-xs font-bold shadow-card
                hover:scale-[1.03] active:scale-95
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                transition-all duration-200
              "
            >
              {t.noGoalsCta}
            </Link>
          </div>
        ) : (
        <>
        <AdherenceCard
          series={adherence}
          labels={{
            title: t.trendsAdherenceTitle,
            within: t.trendsWithinLabel,
            over: t.trendsOverLabel,
            under: t.trendsUnderLabel,
            noData: t.trendsNoDataLabel,
            ofLoggedDays: (n: number) => (lang === 'ja' ? `（記録${n}日中）` : `(of ${n} logged days)`),
          }}
        />

        </>
        )}
      </section>
    </div>
  );
}
