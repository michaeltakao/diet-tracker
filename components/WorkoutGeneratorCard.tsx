'use client';

/**
 * AI Personal Trainer dashboard widget — on-demand full workout plan
 * generation (server: /api/generate-workout). Distinct from
 * RecommendationCard: that card is always-on, history/affinity-based
 * ("based on what you've logged before"); this card is an explicit user
 * action with no sensible default state ("build me a plan for right now"
 * from goal/equipment/time, none of which are inferable the way food/
 * exercise affinity is) — so it renders as a closed button that reveals a
 * form, not an auto-populated card.
 *
 * The server's exercise/set/rep selection is fully deterministic
 * (lib/workout-generator.ts); Gemini only narrates. Rendered exercises route
 * through the existing ExerciseVideo component so they automatically pick up
 * whatever demo images exist.
 */

import { useState } from 'react';
import { Dumbbell, Loader2, AlertCircle, X, Sparkles } from 'lucide-react';
import { postJson } from '@/lib/httpClient';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Equipment } from '@/lib/exercise-db';
import type { MusclePart } from '@/lib/types';
import type { FitnessGoal, TimeAvailableMin, GeneratedPlan } from '@/lib/workout-generator';
import ExerciseVideo from '@/components/ExerciseVideo';

interface GenerateWorkoutResponse {
  plan: GeneratedPlan;
  narrative: { sessionName: string; notes: string; motivationMessage: string };
}

const GOALS: FitnessGoal[] = ['hypertrophy', 'strength', 'endurance', 'weight_loss'];
const EQUIPMENT_OPTIONS: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable'];
const DURATIONS: TimeAvailableMin[] = [15, 30, 45, 60];
const BODY_PARTS: MusclePart[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs'];

export default function WorkoutGeneratorCard() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState<FitnessGoal>('hypertrophy');
  const [equipment, setEquipment] = useState<Set<Equipment>>(new Set());
  const [duration, setDuration] = useState<TimeAvailableMin>(30);
  const [bodyParts, setBodyParts] = useState<Set<MusclePart>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateWorkoutResponse | null>(null);

  const goalLabels: Record<FitnessGoal, string> = {
    hypertrophy: t.workoutGenGoalHypertrophy,
    strength: t.workoutGenGoalStrength,
    endurance: t.workoutGenGoalEndurance,
    weight_loss: t.workoutGenGoalWeightLoss,
  };
  const equipmentLabels: Record<Equipment, string> = {
    barbell: t.workoutGenEquipmentBarbell,
    dumbbell: t.workoutGenEquipmentDumbbell,
    machine: t.workoutGenEquipmentMachine,
    cable: t.workoutGenEquipmentCable,
    bodyweight: '',
  };
  const bodyPartLabels: Record<MusclePart, string> = {
    chest: t.workoutGenBodyPartChest,
    back: t.workoutGenBodyPartBack,
    legs: t.workoutGenBodyPartLegs,
    shoulders: t.workoutGenBodyPartShoulders,
    arms: t.workoutGenBodyPartArms,
    abs: t.workoutGenBodyPartAbs,
  };

  function toggle<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setter(next);
  }

  async function generate() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await postJson<GenerateWorkoutResponse>('/api/generate-workout', {
        goal,
        availableEquipment: [...equipment],
        timeAvailableMin: duration,
        targetBodyParts: [...bodyParts],
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.workoutGenFailed);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="bg-card rounded-2xl shadow-card border border-line p-4 mb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-muted flex items-center gap-1.5">
              <Dumbbell size={15} className="text-brand-600 dark:text-brand-400" aria-hidden="true" />
              {t.workoutGenTitle}
            </h2>
            <p className="text-xs text-faint mt-1">{t.workoutGenIntro}</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 px-3 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]"
          >
            {t.workoutGenOpenButton}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl shadow-card border border-line p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-muted flex items-center gap-1.5">
          <Dumbbell size={15} className="text-brand-600 dark:text-brand-400" aria-hidden="true" />
          {t.workoutGenTitle}
        </h2>
        <button
          onClick={() => { setOpen(false); setResult(null); setError(null); }}
          aria-label={t.workoutGenCloseButton}
          className="p-1.5 rounded-lg text-faint hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl p-3 text-xs mb-3">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!result && (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-faint mb-1.5">{t.workoutGenGoalLabel}</p>
            <div className="flex flex-wrap gap-1.5">
              {GOALS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                    goal === g
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-surface-2 border-line text-muted hover:border-brand-300'
                  }`}
                >
                  {goalLabels[g]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-faint mb-1.5">{t.workoutGenEquipmentLabel}</p>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT_OPTIONS.map((eq) => (
                <button
                  key={eq}
                  onClick={() => toggle(equipment, eq, setEquipment)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                    equipment.has(eq)
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-surface-2 border-line text-muted hover:border-brand-300'
                  }`}
                >
                  {equipmentLabels[eq]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-faint mb-1.5">{t.workoutGenTimeLabel}</p>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                    duration === d
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-surface-2 border-line text-muted hover:border-brand-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-faint mb-1.5">{t.workoutGenBodyPartsLabel}</p>
            <div className="flex flex-wrap gap-1.5">
              {BODY_PARTS.map((p) => (
                <button
                  key={p}
                  onClick={() => toggle(bodyParts, p, setBodyParts)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                    bodyParts.has(p)
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-surface-2 border-line text-muted hover:border-brand-300'
                  }`}
                >
                  {bodyPartLabels[p]}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => void generate()}
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]"
          >
            {loading
              ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              : <Sparkles size={16} aria-hidden="true" />}
            {t.workoutGenGenerateButton}
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-bold text-fg">{result.narrative.sessionName}</p>
            {result.narrative.notes && (
              <p className="text-xs text-muted mt-1">{result.narrative.notes}</p>
            )}
          </div>

          {result.plan.exercises.length === 0 ? (
            <p className="text-xs text-faint py-1">{t.workoutGenEmpty}</p>
          ) : (
            <>
              <p className="text-[10px] font-bold text-faint">
                {t.workoutGenEstDuration.replace('{n}', String(result.plan.estimatedDurationMin))}
              </p>
              <ol className="space-y-3">
                {result.plan.exercises.map((g, i) => (
                  <li key={g.exercise.id} className="space-y-1.5">
                    <div className="flex items-start gap-2.5">
                      <span
                        className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-[10px] font-black flex items-center justify-center mt-0.5"
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-fg leading-tight">{g.exercise.nameJa}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {t.workoutGenSetsReps
                            .replace('{sets}', String(g.sets))
                            .replace('{reps}', g.reps)
                            .replace('{rest}', String(g.restSec))}
                        </p>
                      </div>
                    </div>
                    <ExerciseVideo video={g.exercise.video} exerciseName={g.exercise.nameEn} />
                  </li>
                ))}
              </ol>
            </>
          )}

          {result.narrative.motivationMessage && (
            <p className="text-xs text-brand-700 dark:text-brand-400 font-semibold pt-1">
              {result.narrative.motivationMessage}
            </p>
          )}

          <button
            onClick={() => setResult(null)}
            className="w-full py-2 rounded-xl text-xs font-semibold bg-surface-2 hover:bg-line text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {t.workoutGenOpenButton}
          </button>
        </div>
      )}
    </div>
  );
}
