'use client';

/**
 * Trends pane for /log (?view=trends) — the Phase C research surface.
 *
 * Weight trend + goal projection, TDEE history, intake-vs-expenditure and
 * calorie adherence, all computed by the pure functions in lib/trends.ts.
 * Offline-first: guests get a client-side TDEE estimate from local data;
 * authenticated users get the server history from /api/tdee/history.
 * Recharts components load via next/dynamic so the default weekly view
 * stays light.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { TrendingDown, Flame, Scale, Target } from 'lucide-react';
import { getAllWeightEntries, getAllFoodEntries, getRealGoals, getAllVitalEntries } from '@/lib/data';
// checkin.ts is not in the barrel — direct import.
import { getRecentCheckIns } from '@/lib/data/checkin';
import { getJson } from '@/lib/httpClient';
import { estimateTdee } from '@/lib/tdee';
import {
  smoothWeightSeries,
  projectGoalDate,
  computeDailyBalance,
  computeAdherenceSeries,
  computeMacroShortfall,
  lastNDates,
} from '@/lib/trends';
import { recordEvent } from '@/lib/telemetry';
import { useProfile } from '@/contexts/ProfileContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CARD_CLASS } from '@/components/ui/Card';
import type { DailyGoals, VitalEntry, DailyCheckIn } from '@/lib/types';
import type { TdeePoint } from '@/components/trends/TdeeHistoryChart';

function ChartSkeleton({ h = 190 }: { h?: number }) {
  return <div className="skeleton rounded-2xl w-full" style={{ height: h }} aria-hidden />;
}

const WeightTrendChart = dynamic(
  () => import('@/components/trends/WeightTrendChart').then(m => m.WeightTrendChart),
  { ssr: false, loading: () => <ChartSkeleton h={200} /> },
);
const TdeeHistoryChart = dynamic(
  () => import('@/components/trends/TdeeHistoryChart').then(m => m.TdeeHistoryChart),
  { ssr: false, loading: () => <ChartSkeleton h={180} /> },
);
const IntakeExpenditureChart = dynamic(
  () => import('@/components/trends/IntakeExpenditureChart').then(m => m.IntakeExpenditureChart),
  { ssr: false, loading: () => <ChartSkeleton h={190} /> },
);
const AdherenceCard = dynamic(
  () => import('@/components/trends/AdherenceCard').then(m => m.AdherenceCard),
  { ssr: false, loading: () => <ChartSkeleton h={110} /> },
);
const BpChart = dynamic(
  () => import('@/components/trends/VitalsChart').then(m => m.BpChart),
  { ssr: false, loading: () => <ChartSkeleton h={180} /> },
);
const GlucoseChart = dynamic(
  () => import('@/components/trends/VitalsChart').then(m => m.GlucoseChart),
  { ssr: false, loading: () => <ChartSkeleton h={180} /> },
);
const WellnessChart = dynamic(
  () => import('@/components/trends/VitalsChart').then(m => m.WellnessChart),
  { ssr: false, loading: () => <ChartSkeleton h={140} /> },
);

/** Same "today" convention as the rest of the app (lib/data date stamps). */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

interface TdeeHistoryRow {
  estimated_at: string;
  tdee_kcal: number;
  r_squared: number | null;
  data_points: number;
}

const BALANCE_WINDOW_DAYS = 14;
const WEIGHT_WINDOW_DAYS = 60;

export function TrendsPanel() {
  const { t, lang } = useLanguage();
  const { isAuthenticated } = useProfile();

  // Local data loads once on mount (hydration-safe: this component is only
  // rendered client-side after the view toggle).
  const [loaded, setLoaded] = useState(false);
  const [weightEntries, setWeightEntries] = useState<Array<{ date: string; weight: number }>>([]);
  const [foodEntries, setFoodEntries] = useState<Array<{ date: string; calories: number; protein: number; fat: number; carbs: number }>>([]);
  // null = no real goals set → goal-relative sections (adherence, macro
  // shortfall) sit behind a set-goals CTA; weight/TDEE/balance charts stay.
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [tdeeHistory, setTdeeHistory] = useState<TdeePoint[]>([]);
  const [tdeeIsLocal, setTdeeIsLocal] = useState(false);
  const [vitalEntries, setVitalEntries] = useState<VitalEntry[]>([]);
  const [recentCheckIns, setRecentCheckIns] = useState<DailyCheckIn[]>([]);

  useEffect(() => {
    recordEvent('trends_viewed');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    setWeightEntries(getAllWeightEntries().map(e => ({ date: e.date, weight: e.weight })));
    setFoodEntries(getAllFoodEntries().map(e => ({
      date: e.date, calories: e.calories, protein: e.protein, fat: e.fat, carbs: e.carbs,
    })));
    setGoals(getRealGoals());
    setVitalEntries(getAllVitalEntries());
    setRecentCheckIns(getRecentCheckIns(30));
    setLoaded(true);
  }, []);

  const today = getTodayDate();

  const calorieLogs = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const e of foodEntries) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.calories);
    return [...byDate.entries()].map(([date, totalKcal]) => ({ date, totalKcal }));
  }, [foodEntries]);

  // TDEE source: server history when signed in, on-device estimate for guests.
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    (async () => {
      if (isAuthenticated) {
        try {
          const rows = await getJson<TdeeHistoryRow[]>('/api/tdee/history');
          if (!cancelled) {
            setTdeeHistory(rows.map(r => ({ date: r.estimated_at, tdeeKcal: r.tdee_kcal, rSquared: r.r_squared })));
            setTdeeIsLocal(false);
          }
          return;
        } catch {
          // fall through to the local estimate
        }
      }
      const est = estimateTdee({ weightLogs: weightEntries.map(w => ({ date: w.date, weightKg: w.weight })), calorieLogs, prevTdee: null });
      if (!cancelled) {
        setTdeeHistory(est.tdeeKcal != null ? [{ date: today, tdeeKcal: est.tdeeKcal, rSquared: est.rSquared }] : []);
        setTdeeIsLocal(true);
      }
    })();
    return () => { cancelled = true; };
  }, [loaded, isAuthenticated, weightEntries, calorieLogs, today]);

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
  const balance = useMemo(
    () => computeDailyBalance(axis, calorieLogs, tdeeHistory.map(p => ({ date: p.date, tdeeKcal: p.tdeeKcal }))),
    [axis, calorieLogs, tdeeHistory],
  );
  // Goal-relative series only exist against real goals (null otherwise).
  const adherence = useMemo(
    () => (goals ? computeAdherenceSeries(axis, calorieLogs, goals.calories) : null),
    [axis, calorieLogs, goals],
  );
  const macros = useMemo(
    () => (goals ? computeMacroShortfall(axis, foodEntries, goals) : null),
    [axis, foodEntries, goals],
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
          </>
        ) : (
          <p className="text-xs text-faint py-4 text-center">{t.trendsEmptyDesc}</p>
        )}
      </section>

      {/* ── TDEE history ── */}
      <section className={`${CARD_CLASS} p-4`}>
        <div className="flex items-center gap-2 mb-2">
          <Flame size={14} className="text-ai" aria-hidden />
          <h2 className="text-xs font-black text-faint uppercase tracking-widest">{t.trendsTdeeTitle}</h2>
        </div>
        {tdeeHistory.length > 0 ? (
          <>
            <TdeeHistoryChart
              points={tdeeHistory}
              labels={{ tdee: 'TDEE', confidence: t.trendsConfidenceLabel }}
            />
            {tdeeIsLocal && <p className="text-xs text-faint mt-1">{t.trendsGuestTdeeNote}</p>}
          </>
        ) : (
          <p className="text-xs text-faint py-4 text-center">{t.trendsTdeeEmpty}</p>
        )}
      </section>

      {/* ── Intake vs expenditure ── */}
      <section className={`${CARD_CLASS} p-4`}>
        <h2 className="text-xs font-black text-faint uppercase tracking-widest mb-2">{t.trendsBalanceTitle}</h2>
        {tdeeHistory.length > 0 || loggedDaysInWindow > 0 ? (
          <IntakeExpenditureChart
            points={balance}
            labels={{ intake: t.trendsIntakeLabel, expenditure: t.trendsExpenditureLabel }}
          />
        ) : (
          <p className="text-xs text-faint py-4 text-center">{t.trendsEmptyDesc}</p>
        )}
      </section>

      {/* ── Vitals (record only — neutral display, no thresholds) ── */}
      {(() => {
        const bpPoints = vitalEntries
          .filter((v): v is Extract<VitalEntry, { kind: 'blood_pressure' }> => v.kind === 'blood_pressure')
          .map(v => ({ date: v.date, systolic: v.systolic, diastolic: v.diastolic }));
        const glucosePoints = vitalEntries
          .filter((v): v is Extract<VitalEntry, { kind: 'blood_glucose' }> => v.kind === 'blood_glucose')
          .map(v => ({ date: v.date, glucoseMgDl: v.glucoseMgDl, context: v.glucoseContext }));
        const wellnessPoints = recentCheckIns
          .filter(c => c.sleepQuality != null || c.stressLevel != null)
          .map(c => ({ date: c.date, sleepQuality: c.sleepQuality, stressLevel: c.stressLevel }));
        if (bpPoints.length === 0 && glucosePoints.length === 0 && wellnessPoints.length === 0) return null;
        const chartLabels = {
          systolic: t.systolicLabel,
          diastolic: t.diastolicLabel,
          glucose: t.glucoseLabel,
          sleepQuality: t.sleepQualityLabel,
          stress: t.stressLevelLabel,
          contextLabels: {
            fasting: t.glucoseFasting,
            postprandial: t.glucosePostprandial,
            random: t.glucoseRandom,
          },
        };
        return (
          <section className={`${CARD_CLASS} p-4`}>
            <h2 className="text-xs font-black text-faint uppercase tracking-widest mb-2">{t.trendsVitalsTitle}</h2>
            <div className="space-y-4">
              {bpPoints.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted mb-1">🫀 {t.vitalsBp}</p>
                  <BpChart points={bpPoints} labels={chartLabels} />
                </div>
              )}
              {glucosePoints.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted mb-1">🩸 {t.vitalsGlucose}</p>
                  <GlucoseChart points={glucosePoints} labels={chartLabels} />
                </div>
              )}
              {wellnessPoints.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted mb-1">😴 {t.sleepQualityLabel} / {t.stressLevelLabel}</p>
                  <WellnessChart points={wellnessPoints} labels={chartLabels} />
                </div>
              )}
            </div>
            <p className="text-xs text-faint leading-relaxed mt-3">{t.vitalsDisclaimer}</p>
          </section>
        );
      })()}

      {/* ── Adherence + macro shortfall (goal-relative → needs real goals) ── */}
      <section className={`${CARD_CLASS} p-4`}>
        <h2 className="text-xs font-black text-faint uppercase tracking-widest mb-2">{t.trendsAdherenceTitle}</h2>
        {!(goals && adherence && macros) ? (
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

        {macros.loggedDays > 0 && (
          <div className="mt-4 pt-3 border-t border-line">
            <p className="text-xs font-black text-faint uppercase tracking-widest mb-2">{t.trendsMacroTitle}</p>
            <div className="space-y-1.5">
              {(
                [
                  { label: t.protein, avg: macros.avgProtein, goal: goals.protein, short: macros.proteinShortfallG },
                  { label: t.fat, avg: macros.avgFat, goal: goals.fat, short: macros.fatShortfallG },
                  { label: t.carbs, avg: macros.avgCarbs, goal: goals.carbs, short: macros.carbsShortfallG },
                ] as const
              ).map(({ label, avg, goal, short }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-muted truncate">{label}</span>
                  <span className="tabular-nums font-bold text-fg">{avg ?? '—'}g</span>
                  <span className="text-faint">/ {goal}g</span>
                  {short > 0 && (
                    <span className="ml-auto text-xs font-bold text-warning bg-warning-soft px-2 py-0.5 rounded-full">
                      −{short}g {t.trendsShortfallSuffix}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        </>
        )}
      </section>
    </div>
  );
}
