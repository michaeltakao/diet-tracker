'use client';

/**
 * Home — the core loop on one screen (ADR-011, UX P0 2026-11-26):
 *   today card (kcal + P/F/C vs goals + status chips) → one next step →
 *   four meal slots → one-tap weight → water (1 row) → recommendation
 *   → push opt-in.
 *
 * Every destructive or bulk action is undoable for 5 s (delete, "log the
 * same", copy yesterday); copy yesterday asks first and runs once per day.
 * See docs/ux-audit/REDESIGN_PROPOSAL.md.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Settings, Copy, ArrowRight } from 'lucide-react';
import {
  getAppData, removeFoodEntry, updateFoodEntry, addWater, getWaterForDate,
  addFoodEntry, getRealGoals, getLatestWeightEntry, getWorkoutEntriesForDate,
} from '@/lib/data';
import type { FoodEntry, DailyGoals } from '@/lib/types';
import TodaySummaryCard from '@/components/TodaySummaryCard';
import MealSlotList from '@/components/MealSlotList';
import WaterTracker from '@/components/WaterTracker';
import QuickWeightCard from '@/components/QuickWeightCard';
import PushPermissionCard from '@/components/PushPermissionCard';
import RecommendationCard from '@/components/RecommendationCard';
import BottomNav from '@/components/BottomNav';
import FeedbackButton from '@/components/FeedbackButton';
import { Toast, useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/contexts/LanguageContext';
import { fmtMonthDayDowShortJa, jstTimestamp, nowJstTime, shiftDate, todayJst } from '@/lib/format-date';
import { sumIntake } from '@/lib/macros';
import {
  MEAL_SLOTS, groupBySlot, filledMainSlots, lastSlotMeal, repeatEntry, planCopyYesterday,
  type MealSlot, type LastSlotMeal, type CopyPlan,
} from '@/lib/meal-slots';
import { nextAction, type NextAction } from '@/lib/next-action';
import { takeUndoHint } from '@/lib/undo-hint';

/** JST day "copy yesterday" last ran on this device (UX state, not study data). */
const COPIED_ON_KEY = 'diet-tracker:copied-yesterday-on';

const ICON_BTN = `
  w-11 h-11 rounded-2xl
  bg-card shadow-card border border-line
  flex items-center justify-center
  text-faint hover:text-fg
  active:scale-95
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
  transition-all duration-200
`;

interface HomeState {
  all: FoodEntry[];
  goals: DailyGoals | null;
  water: number;
  weightToday: boolean;
  workoutToday: boolean;
}

function readState(today: string): HomeState {
  const data = getAppData();
  return {
    all: data.foodEntries,
    goals: getRealGoals(),
    water: getWaterForDate(today),
    weightToday: getLatestWeightEntry()?.date === today,
    workoutToday: getWorkoutEntriesForDate(today).length > 0,
  };
}

function focusWeightInput() {
  const el = document.getElementById('quick-weight-input');
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el?.focus({ preventScroll: true });
}

export default function HomePage() {
  const { t } = useLanguage();
  const [today]                 = useState(todayJst());
  // null until the client-only read resolves: render a skeleton, never
  // fabricated numbers or a flash of the empty state.
  const [state, setState]       = useState<HomeState | null>(null);
  const [copyPlan, setCopyPlan] = useState<Extract<CopyPlan, { ok: true }> | null>(null);
  const busy = useRef(false);
  const toast = useToast();

  const reload = () => setState(readState(today));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    reload();
    // Undo hand-off from /add (lib/undo-hint.ts).
    const hint = takeUndoHint();
    if (hint) {
      toast.show(`✓ ${hint.label}`, {
        label: t.undo,
        onClick: () => {
          for (const id of hint.ids) void removeFoodEntry(id);
          reload();
          toast.show(t.undoDone);
        },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Write `entries` and offer one Undo that removes exactly those ids. */
  const addUndoable = async (entries: FoodEntry[], message: string, onUndo?: () => void) => {
    for (const e of entries) await addFoodEntry(e);
    reload();
    toast.show(message, {
      label: t.undo,
      onClick: () => {
        for (const e of entries) void removeFoodEntry(e.id);
        onUndo?.();
        reload();
        toast.show(t.undoDone);
      },
    });
  };

  const handleDelete = (id: string) => {
    const entry = state?.all.find((e) => e.id === id);
    void removeFoodEntry(id);
    reload();
    if (!entry) return;
    toast.show(t.deletedToast.replace('{name}', entry.name), {
      label: t.undo,
      onClick: () => {
        // Same id: the outbox upsert supersedes the queued delete (or
        // re-creates the row if the delete was already sent).
        void addFoodEntry(entry);
        reload();
        toast.show(t.undoDone);
      },
    });
  };

  // lib/data writes localStorage synchronously before awaiting the outbox,
  // so reading back right after the call already sees the change.
  const handleEdit = (updated: FoodEntry) => { void updateFoodEntry(updated); reload(); };

  const handleAddWater = async (ml: number) => {
    await addWater(today, ml);
    setState((s) => (s ? { ...s, water: getWaterForDate(today) } : s));
  };

  const handleRepeat = async (slot: MealSlot) => {
    if (busy.current || !state) return;
    const last = lastSlotMeal(state.all, slot, today);
    if (!last) return;
    busy.current = true;
    try {
      const at = jstTimestamp(today, nowJstTime());
      const copies = last.entries.map((e) => repeatEntry(e, slot, today, at, crypto.randomUUID()));
      await addUndoable(copies, copies.length === 1
        ? `✓ ${t.loggedToast.replace('{name}', copies[0].name)}`
        : `✓ ${t.loggedManyToast.replace('{n}', String(copies.length))}`);
    } finally {
      busy.current = false;
    }
  };

  const askCopyYesterday = () => {
    if (!state) return;
    const plan = planCopyYesterday(state.all, today, shiftDate(today, -1), localStorage.getItem(COPIED_ON_KEY));
    if (!plan.ok) {
      toast.show(plan.reason === 'empty' ? t.noYesterdayData : t.copyYesterdayAlready);
      return;
    }
    setCopyPlan(plan);
  };

  const confirmCopyYesterday = async () => {
    const plan = copyPlan;
    setCopyPlan(null);
    if (!plan || busy.current) return;
    busy.current = true;
    localStorage.setItem(COPIED_ON_KEY, today);
    try {
      const at = new Date().toISOString();
      const copies = plan.entries.map((e) => ({ ...e, id: crypto.randomUUID(), date: today, addedAt: at, photoDataUrl: undefined }));
      // Undoing the copy also re-allows it today.
      await addUndoable(copies, `✓ ${t.copyYesterdayDone}`, () => localStorage.removeItem(COPIED_ON_KEY));
    } finally {
      busy.current = false;
    }
  };

  // ── Derived view state ───────────────────────────────────────────────────
  const entries = state ? state.all.filter((e) => e.date === today) : [];
  const totals  = sumIntake(entries);
  const grouped = groupBySlot(entries);
  const filled  = filledMainSlots(entries);
  const lastMeals = Object.fromEntries(
    MEAL_SLOTS.map((s) => [s, state && grouped[s].length === 0 ? lastSlotMeal(state.all, s, today) : null]),
  ) as Record<MealSlot, LastSlotMeal | null>;
  const next: NextAction | null = state
    ? nextAction({ hasGoals: state.goals !== null, filledSlots: filled, weightLoggedToday: state.weightToday, nowJst: nowJstTime() })
    : null;

  const slotLabel: Record<MealSlot, string> = { breakfast: t.breakfast, lunch: t.lunch, dinner: t.dinner, snack: t.snack };

  return (
    <div className="max-w-md lg:max-w-2xl mx-auto pb-28 lg:pb-8 px-4 lg:px-6 bg-[var(--background)] min-h-screen">
      <Toast message={toast.message} action={toast.action} variant="neutral" />
      <ConfirmDialog
        open={copyPlan !== null}
        title={t.copyYesterdayConfirmTitle}
        description={copyPlan ? t.copyYesterdayConfirmBody
          .replace('{n}', String(copyPlan.entries.length))
          .replace('{kcal}', copyPlan.calories.toLocaleString()) : undefined}
        confirmLabel={t.copyYesterdayConfirm}
        cancelLabel={t.cancel}
        onConfirm={() => void confirmCopyYesterday()}
        onCancel={() => setCopyPlan(null)}
      />

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between pt-4 pb-3">
        <div>
          <h1 className="text-xl font-black text-fg tracking-tight">{fmtMonthDayDowShortJa(today)}</h1>
          <p className="text-xs text-faint font-medium">{t.appName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={askCopyYesterday}
            title={t.copyYesterdayDesc}
            aria-label={t.copyYesterdayDesc}
            className={ICON_BTN}
          >
            <Copy size={16} aria-hidden="true" />
          </button>
          <Link href="/settings" aria-label={t.settings} className={ICON_BTN}>
            <Settings size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {state === null ? (
        <div aria-busy="true" aria-label={t.loadingLabel} data-testid="home-skeleton">
          <div className="skeleton rounded-2xl h-48 mb-3" />
          <div className="skeleton rounded-2xl h-14 mb-3" />
          <div className="skeleton rounded-2xl h-52 mb-3" />
        </div>
      ) : (
        <>
          {/* ── 1. Today ─────────────────────────────── */}
          {state.goals ? (
            <TodaySummaryCard
              goals={state.goals}
              totals={totals}
              status={{ mainMealsLogged: filled.length, workoutLogged: state.workoutToday, weightLogged: state.weightToday }}
              onWeightChip={focusWeightInput}
            />
          ) : (
            <div className="bg-card rounded-2xl shadow-card border border-line p-5 text-center mb-3">
              <p className="text-sm font-semibold text-muted">{t.noGoalsTitle}</p>
              <p className="text-xs text-faint mt-1 mb-4">{t.noGoalsSub}</p>
              <Button href="/onboarding" size="lg">{t.noGoalsCta}</Button>
              <div className="mt-2">
                <Link href="/settings" className="inline-flex items-center min-h-11 text-xs text-faint underline underline-offset-2 hover:text-fg transition-colors">
                  {t.noGoalsSettingsLink}
                </Link>
              </div>
            </div>
          )}

          {/* ── 2. Next step (one, deterministic) ────── */}
          {next && next.kind !== 'set-goals' && (
            <NextStep action={next} slotLabel={slotLabel} />
          )}

          {/* ── 3. Today's meals ─────────────────────── */}
          <h2 id="meals" className="text-sm font-bold text-muted mb-2 mt-1 scroll-mt-4">{t.todayMeals}</h2>
          <MealSlotList
            grouped={grouped}
            lastMeals={lastMeals}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onRepeat={(s) => void handleRepeat(s)}
          />

          {/* ── 4. One-tap weight ────────────────────── */}
          <QuickWeightCard onSaved={reload} />

          {/* ── 5. Water (one row) ───────────────────── */}
          <div className="bg-card rounded-2xl shadow-card border border-line px-4 py-2 mb-3">
            <WaterTracker current={state.water} goal={state.goals?.water ?? 2000} onAdd={(ml) => void handleAddWater(ml)} />
          </div>
        </>
      )}

      {/* ── 6. Safe recommendation (thesis artifact) ─ */}
      <RecommendationCard />

      {/* ── Web Push opt-in (authed users, sticky dismissal) ── */}
      <PushPermissionCard />

      <FeedbackButton inline />

      <BottomNav />
    </div>
  );
}

function NextStep({ action, slotLabel }: { action: Exclude<NextAction, { kind: 'set-goals' }>; slotLabel: Record<MealSlot, string> }) {
  const { t } = useLanguage();
  const text =
    action.kind === 'log-meal' ? t.nextLogMeal.replace('{slot}', slotLabel[action.slot])
    : action.kind === 'log-weight' ? t.nextLogWeight
    : t.nextDone;
  const cta = action.kind === 'done' ? t.nextDoneCta : t.nextGo;
  const cls = `
    shrink-0 inline-flex items-center gap-1 min-h-11 px-4 rounded-xl text-sm font-black
    bg-brand-strong text-white active:translate-y-[1px]
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
  `;
  return (
    <div
      data-testid="next-action"
      data-kind={action.kind}
      className="flex items-center gap-3 bg-card rounded-2xl shadow-card border border-line pl-4 pr-2 py-2 mb-3"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-faint uppercase tracking-widest">{t.nextActionLabel}</p>
        <p className="text-sm font-bold text-fg truncate">{text}</p>
      </div>
      {action.kind === 'log-meal' && (
        <Link href={`/add?meal=${action.slot}`} className={cls}>{cta}<ArrowRight size={14} aria-hidden="true" /></Link>
      )}
      {action.kind === 'log-weight' && (
        <button type="button" onClick={focusWeightInput} className={cls}>{cta}<ArrowRight size={14} aria-hidden="true" /></button>
      )}
      {action.kind === 'done' && (
        <Link href="/log" className={cls}>{cta}<ArrowRight size={14} aria-hidden="true" /></Link>
      )}
    </div>
  );
}
