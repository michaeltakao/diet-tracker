'use client';

/**
 * Renders a deterministic workout plan (P0 #9) inside the /workout
 * session-start flow.
 *
 * This is the /workout counterpart to WorkoutGeneratorCard's result view: the
 * exercises, sets and reps come from lib/workout-generator.ts on the server,
 * and the narrative text is the LLM's only contribution. Keeping the two
 * renderers separate — rather than lifting one shared component — is
 * deliberate: the dashboard card owns a whole form (goal/equipment/time
 * pickers) that SessionStart already collects through its own chip flow.
 *
 * Swap (roadmap §4 step 8) re-runs the deterministic engine client-side via
 * onSwap; it never calls the LLM, so swapping an exercise costs no tokens and
 * cannot change sets/reps.
 */

import { Zap, RefreshCw, Shuffle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { GeneratedPlan } from '@/lib/workout-generator';
import ExerciseVideo from '@/components/ExerciseVideo';

export interface GeneratedPlanResult {
  plan: GeneratedPlan;
  narrative: { sessionName: string; notes: string; motivationMessage: string };
}

export default function GeneratedPlanCard({
  result,
  loading,
  error,
  onRefresh,
  onSwap,
  canSwap,
}: {
  result: GeneratedPlanResult | null;
  loading: boolean;
  error: 'auth' | 'error' | null;
  onRefresh: () => void;
  /** Swap one exercise for the next deterministic alternative (no LLM call). */
  onSwap: (exerciseId: string) => void;
  /** False when no alternative is left to offer; the swap control is then disabled. */
  canSwap: (exerciseId: string) => boolean;
}) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-line p-4 shadow-[0_4px_16px_rgb(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center animate-pulse shrink-0">
            <Zap size={17} className="text-indigo-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-fg">{t.aiAnalyzingTitle}</p>
            <p className="text-xs text-faint">{t.aiGeneratingDesc}</p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {[40, 60, 30].map((w, i) => (
            <div key={i} className="h-3 bg-surface-2 rounded-full animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error === 'auth') {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <Zap size={17} className="text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-blue-700 dark:text-blue-300">{t.aiLoginRequiredTitle}</p>
            <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">{t.checkInSavedDesc}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error === 'error') {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800 p-4 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-red-600 dark:text-red-400">{t.aiSuggestionFailed}</p>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-500 text-xs font-bold hover:bg-red-200 transition-colors"
        >
          <RefreshCw size={12} />
          {t.retry}
        </button>
      </div>
    );
  }

  if (!result) return null;

  const { plan, narrative } = result;

  return (
    <div className="rounded-2xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 p-4 shadow-[0_4px_16px_rgb(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-card/60 flex items-center justify-center shrink-0">
            <Zap size={17} className="text-brand-700 dark:text-brand-300" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-brand-700 dark:text-brand-300 opacity-60">
              {t.aiSuggestionLabel}
            </p>
            <p className="text-base font-black text-brand-700 dark:text-brand-300">{narrative.sessionName}</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl hover:bg-card/50 transition-colors"
          title={t.retry}
          aria-label={t.retry}
        >
          <RefreshCw size={14} className="text-brand-700 dark:text-brand-300" />
        </button>
      </div>

      {narrative.notes && (
        <p className="text-xs text-brand-700 dark:text-brand-300 opacity-80 mb-3 bg-card/40 px-3 py-2 rounded-xl">
          {narrative.notes}
        </p>
      )}

      {plan.exercises.length === 0 ? (
        <p className="text-xs text-muted py-1">{t.workoutGenEmpty}</p>
      ) : (
        <>
          <p className="text-[10px] font-bold text-brand-700 dark:text-brand-300 opacity-70 mb-2">
            {t.workoutGenEstDuration.replace('{n}', String(plan.estimatedDurationMin))}
          </p>
          <ol className="space-y-3">
            {plan.exercises.map((g, i) => {
              const swappable = canSwap(g.exercise.id);
              return (
              <li key={g.exercise.id} className="space-y-1.5">
                <div className="flex items-start gap-2.5">
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full bg-card/70 text-brand-700 dark:text-brand-300 text-[10px] font-black flex items-center justify-center mt-0.5"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-fg leading-tight">{g.exercise.nameJa}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {t.workoutGenSetsReps
                        .replace('{sets}', String(g.sets))
                        .replace('{reps}', g.reps)
                        .replace('{rest}', String(g.restSec))}
                    </p>
                  </div>
                  <button
                    onClick={() => onSwap(g.exercise.id)}
                    disabled={!swappable}
                    aria-disabled={!swappable}
                    title={t.swapExercise}
                    aria-label={`${t.swapExercise}: ${g.exercise.nameJa}`}
                    className="shrink-0 p-1.5 rounded-lg text-brand-700 dark:text-brand-300 hover:bg-card/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <Shuffle size={13} aria-hidden="true" />
                  </button>
                </div>
                <ExerciseVideo video={g.exercise.video} exerciseName={g.exercise.nameEn} />
              </li>
              );
            })}
          </ol>
        </>
      )}

      {narrative.motivationMessage && (
        <p className="text-sm font-black text-brand-700 dark:text-brand-300 border-t border-current border-opacity-10 pt-3 mt-3">
          {narrative.motivationMessage}
        </p>
      )}
    </div>
  );
}
