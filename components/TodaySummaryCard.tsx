'use client';

/**
 * Home "today" card (UX P0 slice 4, REDESIGN_PROPOSAL §2): kcal left vs
 * goal, P/F/C against their goals, and three status chips. Presentational;
 * the dashboard owns the data.
 *
 * P/F/C come from lib/macros.ts sumIntake, so kcal-only meals (029) never
 * count as 0 g measurements; when any exist the macro line says "partial".
 */
import Link from 'next/link';
import type { DailyGoals } from '@/lib/types';
import type { IntakeTotals } from '@/lib/macros';
import { useLanguage } from '@/contexts/LanguageContext';

export interface TodayStatus {
  mainMealsLogged: number;
  workoutLogged: boolean;
  weightLogged: boolean;
}

interface Props {
  goals: DailyGoals;
  totals: IntakeTotals;
  status: TodayStatus;
  onWeightChip: () => void;
}

const CHIP = `
  inline-flex items-center gap-1 min-h-11 px-3 rounded-xl
  text-xs font-bold tabular-nums
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
`;

function chipTone(done: boolean): string {
  return done ? 'bg-white text-brand-strong' : 'bg-white/20 text-white';
}

export function TodaySummaryCard({ goals, totals, status, onWeightChip }: Props) {
  const { t } = useLanguage();
  const over = totals.calories > goals.calories;
  const remaining = Math.max(0, goals.calories - totals.calories);
  const pct = goals.calories > 0 ? Math.min(100, Math.round((totals.calories / goals.calories) * 100)) : 0;
  const hasMacros = totals.enteredCount > 0;

  const macros = [
    { key: 'P', value: totals.protein, goal: goals.protein },
    { key: 'F', value: totals.fat, goal: goals.fat },
    { key: 'C', value: totals.carbs, goal: goals.carbs },
  ].filter((m) => m.goal > 0);

  return (
    <section
      aria-label={t.todayCardTitle}
      data-testid="today-card"
      className={`
        rounded-2xl p-4 mb-3 shadow-elevated text-white
        ${over ? 'bg-gradient-to-br from-amber-600 to-red-700' : 'bg-gradient-to-br from-brand-600 to-brand-700'}
      `}
    >
      <div className="flex items-end justify-between gap-3 mb-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/85">
            {over ? `⚠️ ${t.overLabel}` : t.remaining}
          </p>
          <p className="flex items-baseline gap-1.5">
            <span className="text-4xl font-black tracking-tight leading-none tabular-nums">
              {over ? `+${(totals.calories - goals.calories).toLocaleString()}` : remaining.toLocaleString()}
            </span>
            <span className="text-base text-white/85 font-medium">kcal</span>
          </p>
        </div>
        <p className="text-xs text-white/85 font-medium tabular-nums text-right">
          {totals.calories.toLocaleString()} / {goals.calories.toLocaleString()} kcal
        </p>
      </div>

      <div
        className="h-2 rounded-full bg-white/25 overflow-hidden mb-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={t.consumed}
      >
        <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {macros.length > 0 && (
        <div className="mb-3">
          <dl className="grid grid-cols-3 gap-2 text-xs tabular-nums">
            {macros.map((m) => (
              <div key={m.key}>
                <dt className="sr-only">{m.key}</dt>
                <dd className="font-bold">
                  {m.key} {hasMacros ? Math.round(m.value) : '–'}
                  <span className="text-white/75 font-medium">/{Math.round(m.goal)}g</span>
                </dd>
                <div className="h-1 rounded-full bg-white/25 overflow-hidden mt-1" aria-hidden="true">
                  <div
                    className="h-full bg-white/90 rounded-full"
                    style={{ width: `${hasMacros ? Math.min(100, (m.value / m.goal) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </dl>
          {totals.kcalOnlyCount > 0 && (
            <p className="text-[11px] text-white/80 mt-1">{t.macrosPartialNote}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <a href="#meals" className={`${CHIP} ${chipTone(status.mainMealsLogged >= 3)}`}>
          <span aria-hidden="true">🍽</span> {t.chipMeals.replace('{n}', String(status.mainMealsLogged))}
        </a>
        <Link href="/workout" className={`${CHIP} ${chipTone(status.workoutLogged)}`}>
          <span aria-hidden="true">🏋</span> {status.workoutLogged ? t.chipWorkoutDone : t.chipWorkoutNone}
        </Link>
        <button type="button" onClick={onWeightChip} className={`${CHIP} ${chipTone(status.weightLogged)}`}>
          <span aria-hidden="true">⚖</span> {status.weightLogged ? t.chipWeightDone : t.chipWeightNone}
        </button>
      </div>
    </section>
  );
}
