'use client';

/**
 * Session-start flow (P0 #9, FTUE roadmap): the single entry point into a
 * workout day. Replaces the old split between /plan's CheckInWidget (mood/
 * energy/sleep/soreness → AI suggestion) and /workout's bare logging form.
 *
 * Flow: location chip → duration chip → equipment preset (editable) →
 * 3-level energy → soreness → save. Rest Day short-circuits immediately
 * after the location chip: no duration/equipment/energy/soreness, no
 * exercise suggestion — just an affirmation and a streak-continues note.
 *
 * On completion this saves a DailyCheckIn (energy mapped via
 * energyLevelToScale — see lib/session-start.ts for why that mapping is
 * intentionally lossy), updates WorkoutPrefs (including recordLocationChoice
 * for tomorrow's default), and requests a workout plan.
 *
 * P0 #9 (roadmap §4): that request goes to `/api/generate-workout`, where a
 * deterministic engine (lib/workout-generator.ts) picks the exercises, sets
 * and reps and the LLM only narrates them. It previously went to
 * `/api/suggest-workout`, where the model chose the exercises freely — the
 * exact inversion this roadmap item exists to fix. The chips this flow
 * already collects (duration, equipment, energy, soreness) are now the
 * engine's inputs rather than prose in a prompt, and recent logged workouts
 * are folded in as per-muscle recovery data.
 *
 * If today's check-in is already saved, renders a collapsed summary with a
 * "change" affordance that re-expands the full flow.
 */

import { shiftDate } from '@/lib/streak';
import { useEffect, useState, useCallback } from 'react';
import {
  Brain, Flame, Dumbbell, ChevronUp, Wind,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCheckIn, saveCheckIn, todayDate } from '@/lib/data/checkin';
import {
  getWorkoutPrefs, saveWorkoutPrefs, recordLocationChoice,
  type WorkoutPrefs, type TrainingLocation, type SessionDuration,
} from '@/lib/data/workout-prefs';
import { getHealthProfile } from '@/lib/data/health-profile';
import { getWorkoutEntriesForRange } from '@/lib/data/workout';
import {
  energyLevelToScale, pickDefaultLocation, LOCATION_EQUIPMENT_DEFAULTS,
  profileGoalToTrainingGoal, toTimeAvailableMin, toRecentMuscleParts, nextSwapCandidate,
  type EnergyLevel,
} from '@/lib/session-start';
import { alternativesFor, type GeneratePlanInput } from '@/lib/workout-generator';
import type { Equipment, ExerciseDef } from '@/lib/exercise-db';
import type { DailyCheckIn, MusclePart } from '@/lib/types';
import GeneratedPlanCard, { type GeneratedPlanResult } from '@/components/GeneratedPlanCard';
import { postJson, HttpError } from '@/lib/httpClient';

const ALL_MUSCLES: MusclePart[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs'];

const MUSCLE_COLORS: Record<string, string> = {
  chest:     'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
  back:      'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  legs:      'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  shoulders: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  arms:      'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400',
  abs:       'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
};
const MUSCLE_LABELS_JA: Record<string, string> = {
  chest: '胸', back: '背中', legs: '脚', shoulders: '肩', arms: '腕', abs: '腹',
};
const MUSCLE_LABELS_EN: Record<string, string> = {
  chest: 'Chest', back: 'Back', legs: 'Legs', shoulders: 'Shoulders', arms: 'Arms', abs: 'Abs',
};

const LOCATIONS: Array<{ id: TrainingLocation; labelKey: 'locationHome' | 'locationGym' | 'locationHotelGym' | 'locationOutdoor' | 'locationRestDay' }> = [
  { id: 'home',      labelKey: 'locationHome' },
  { id: 'gym',       labelKey: 'locationGym' },
  { id: 'hotel_gym', labelKey: 'locationHotelGym' },
  { id: 'outdoor',   labelKey: 'locationOutdoor' },
  { id: 'rest_day',  labelKey: 'locationRestDay' },
];

const DURATIONS: Array<{ id: SessionDuration; labelKey: 'duration15' | 'duration30' | 'duration45' | 'duration60' }> = [
  { id: 15, labelKey: 'duration15' },
  { id: 30, labelKey: 'duration30' },
  { id: 45, labelKey: 'duration45' },
  { id: 60, labelKey: 'duration60' },
];

const ENERGY_LEVELS: Array<{ id: EnergyLevel; labelKey: 'energyLow' | 'energyMedium' | 'energyHigh' }> = [
  { id: 'low',    labelKey: 'energyLow' },
  { id: 'medium', labelKey: 'energyMedium' },
  { id: 'high',   labelKey: 'energyHigh' },
];

/** Request body for /api/generate-workout, built from this flow's chips. */
type PlanInput = Omit<GeneratePlanInput, 'targetBodyParts'> & { targetBodyParts?: MusclePart[] };

/**
 * Inverse of energyLevelToScale, for the reload path where only the stored
 * 1–5 DailyCheckIn.energy survives. The round trip is lossy by construction
 * (3 levels ↔ 5 points, see lib/session-start.ts), so this splits the 1–5
 * range into thirds rather than pretending to recover the original chip.
 */
function scaleToEnergyLevel(energy: DailyCheckIn['energy']): EnergyLevel {
  if (energy <= 2) return 'low';
  if (energy >= 4) return 'high';
  return 'medium';
}

export default function SessionStart({
  onComplete,
}: {
  /** Called once the flow is complete: rest === true means Rest Day. */
  onComplete: (result: { rest: boolean }) => void;
}) {
  const { t, lang } = useLanguage();
  const MUSCLE_LABELS = lang === 'en' ? MUSCLE_LABELS_EN : MUSCLE_LABELS_JA;
  const today = todayDate();

  const [loaded, setLoaded] = useState(false);
  const [savedToday, setSavedToday] = useState<DailyCheckIn | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [restDayToday, setRestDayToday] = useState(false);

  const [location, setLocation] = useState<TrainingLocation | undefined>(undefined);
  const [duration, setDuration] = useState<SessionDuration | undefined>(undefined);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel | undefined>(undefined);
  const [sorenessAreas, setSorenessAreas] = useState<MusclePart[]>([]);

  const [planResult, setPlanResult]       = useState<GeneratedPlanResult | null>(null);
  const [planLoading, setPlanLoading]     = useState(false);
  const [planError, setPlanError]         = useState<'auth' | 'error' | null>(null);
  /** Engine inputs from the last successful fetch, replayed by swap (no LLM). */
  const [lastPlanInput, setLastPlanInput] = useState<PlanInput | null>(null);
  /** Exercises swapped out of the current plan, so repeated swaps don't toggle back. */
  const [swappedOut, setSwappedOut]       = useState<ReadonlySet<string>>(new Set());

  // Hydration-safe client-only load on mount.
  useEffect(() => {
    const saved = getCheckIn(today);
    const prefs = getWorkoutPrefs();
    const weekday = new Date(`${today}T00:00:00`).getDay();
    const defaultLoc = pickDefaultLocation(prefs.recentLocations, weekday, prefs.lastLocation);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only localStorage read on mount
    if (defaultLoc) setLocation(defaultLoc);
    if (prefs.lastDuration) setDuration(prefs.lastDuration);
    if (defaultLoc && prefs.equipmentByLocation[defaultLoc]) {
      setEquipment(prefs.equipmentByLocation[defaultLoc]!);
    } else if (defaultLoc) {
      setEquipment(LOCATION_EQUIPMENT_DEFAULTS[defaultLoc]);
    }
    if (saved) {
      setSavedToday(saved);
      setExpanded(false);
      setSorenessAreas(saved.sorenessAreas);
    }
    setLoaded(true);
  }, [today]);

  /**
   * Build the deterministic engine's inputs from what this flow knows, then
   * ask the server for a plan. Everything here is data the chips already
   * collected plus locally logged history — no free-text prompt.
   */
  const buildPlanInput = useCallback((
    ci: DailyCheckIn,
    dur?: SessionDuration,
    equip?: Equipment[],
  ): PlanInput => {
    const profile = getHealthProfile();

    // 14 days back: long enough that a weekly split shows up as recovery
    // data, short enough that a long layoff doesn't look like recent work.
    const start = shiftDate(today, -14);

    return {
      goal: profileGoalToTrainingGoal(profile.fitnessGoal),
      availableEquipment: equip ?? [],
      timeAvailableMin: toTimeAvailableMin(dur),
      sorenessAreas: ci.sorenessAreas,
      energyLevel: scaleToEnergyLevel(ci.energy),
      recentMuscleParts: toRecentMuscleParts(getWorkoutEntriesForRange(start, today), today),
    };
  }, [today]);

  const fetchPlan = useCallback(async (
    ci: DailyCheckIn,
    dur?: SessionDuration,
    equip?: Equipment[],
  ) => {
    setPlanLoading(true);
    setPlanResult(null);
    setPlanError(null);
    const input = buildPlanInput(ci, dur, equip);
    setLastPlanInput(input);
    setSwappedOut(new Set());
    try {
      const data = await postJson<GeneratedPlanResult>('/api/generate-workout', input);
      setPlanResult(data);
    } catch (err) {
      setPlanError(err instanceof HttpError && err.status === 401 ? 'auth' : 'error');
    } finally {
      setPlanLoading(false);
    }
  }, [buildPlanInput]);

  /** Alternatives for one exercise, best first (empty before the first fetch). */
  const swapPool = useCallback((exerciseId: string): ExerciseDef[] => {
    if (!lastPlanInput) return [];
    return alternativesFor({ ...lastPlanInput, targetBodyParts: [] }, exerciseId);
  }, [lastPlanInput]);

  /** Whether the swap control for `exerciseId` has anything to offer. */
  const canSwap = useCallback((exerciseId: string): boolean => {
    if (!planResult) return false;
    const inPlan = new Set(planResult.plan.exercises.map((g) => g.exercise.id));
    return swapPool(exerciseId).some((e) => !inPlan.has(e.id));
  }, [planResult, swapPool]);

  /**
   * Swap one exercise for the next deterministic alternative in the same
   * muscle part (roadmap §4 step 8). alternativesFor() runs in the browser,
   * so a swap costs nothing and cannot change sets or reps. The narrative
   * text is kept as-is: it describes the session as a whole, and
   * re-narrating would mean another LLM call for a one-tap edit.
   *
   * Exercises swapped out are remembered (nextSwapCandidate) so that
   * repeated swaps of one slot walk the whole pool instead of toggling
   * between two. A no-op only when canSwap() is false, in which case the
   * control is disabled.
   */
  const swapExercise = useCallback((exerciseId: string) => {
    if (!planResult) return;
    const idx = planResult.plan.exercises.findIndex((g) => g.exercise.id === exerciseId);
    if (idx === -1) return;

    const current = planResult.plan.exercises[idx];
    const inPlan = new Set(planResult.plan.exercises.map((g) => g.exercise.id));
    const pool = swapPool(exerciseId);
    const next = nextSwapCandidate(pool.map((e) => e.id), inPlan, new Set([...swappedOut, exerciseId]));
    const replacement = next && pool.find((e) => e.id === next.id);
    if (!next || !replacement) return;

    const exercises = [...planResult.plan.exercises];
    // Keep the current sets/reps/rest: volume is the goal+energy scheme's
    // decision, not the individual exercise's.
    exercises[idx] = { ...current, exercise: replacement };
    setPlanResult({ ...planResult, plan: { ...planResult.plan, exercises } });
    setSwappedOut(next.swappedOut);
  }, [planResult, swapPool, swappedOut]);

  // Auto-fetch the plan when a check-in for today already exists (page reload mid-flow).
  useEffect(() => {
    if (!loaded || !savedToday) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot auto-fetch when a saved check-in already exists
    fetchPlan(savedToday, duration, equipment);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on load, not on every duration/equipment edit
  }, [loaded, savedToday]);

  const selectLocation = (loc: TrainingLocation) => {
    setLocation(loc);
    if (loc === 'rest_day') return;
    const prefs = getWorkoutPrefs();
    const preset = prefs.equipmentByLocation[loc] ?? LOCATION_EQUIPMENT_DEFAULTS[loc];
    setEquipment(preset);
  };

  const toggleEquipment = (id: Equipment) => {
    setEquipment((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]);
  };

  const toggleSoreness = (part: MusclePart) => {
    setSorenessAreas((prev) => prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]);
  };

  const persistPrefs = (loc: TrainingLocation, dur: SessionDuration | undefined, equip: Equipment[]) => {
    const prefs: WorkoutPrefs = getWorkoutPrefs();
    prefs.lastLocation = loc;
    if (dur) prefs.lastDuration = dur;
    if (equip.length > 0) prefs.equipmentByLocation[loc] = equip;
    saveWorkoutPrefs(prefs);
    recordLocationChoice(loc, today);
  };

  const handleRestDayConfirm = () => {
    if (!location) return;
    persistPrefs(location, undefined, []);
    setRestDayToday(true);
    onComplete({ rest: true });
  };

  const handleSave = () => {
    if (!location || location === 'rest_day' || !energyLevel) return;
    persistPrefs(location, duration, equipment);
    const ci: DailyCheckIn = {
      date: today,
      mood: (savedToday?.mood ?? 3) as DailyCheckIn['mood'],
      energy: energyLevelToScale(energyLevel),
      sleepHours: savedToday?.sleepHours ?? 7,
      sorenessAreas,
      notes: savedToday?.notes,
    };
    setSavedToday(ci);
    saveCheckIn(ci);
    fetchPlan(ci, duration, equipment);
    setExpanded(false);
    onComplete({ rest: false });
  };

  if (!loaded) return null;

  // ── Rest Day short-circuit ────────────────────────────────────────────
  if (restDayToday || (savedToday === null && location === 'rest_day' && !expanded)) {
    return (
      <div className="bg-card rounded-2xl border border-line p-4 shadow-[0_4px_16px_rgb(0,0,0,0.04)] text-center space-y-2">
        <p className="text-lg font-black text-fg">{t.restDayTitle}</p>
        <p className="text-sm text-muted">{t.restDayBody}</p>
        <p className="text-xs text-brand-600 dark:text-brand-400 font-bold">{t.restDayStreakContinues}</p>
        <p className="text-xs text-faint">{t.restDayStretchSuggestion}</p>
        <button
          onClick={() => onComplete({ rest: false })}
          className="mt-2 text-xs font-bold text-faint underline hover:text-fg transition-colors"
        >
          {t.restDayLogAnyway}
        </button>
      </div>
    );
  }

  // ── Collapsed (already completed today) ───────────────────────────────
  if (!expanded && savedToday) {
    return (
      <div className="space-y-3">
        <div className="bg-card rounded-2xl border border-line p-4 shadow-[0_4px_16px_rgb(0,0,0,0.04)] flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-fg">{t.sessionStartCompletedLabel}</p>
            <p className="text-xs text-faint mt-0.5">
              {location && t[LOCATIONS.find((l) => l.id === location)?.labelKey ?? 'locationHome']}
            </p>
          </div>
          <button
            onClick={() => setExpanded(true)}
            className="text-xs font-bold text-brand-600 dark:text-brand-400 underline hover:no-underline transition-all"
          >
            {t.sessionStartChangeCta}
          </button>
        </div>
        {(planResult || planLoading || planError) && (
          <GeneratedPlanCard
            result={planResult}
            loading={planLoading}
            error={planError}
            onRefresh={() => savedToday && fetchPlan(savedToday, duration, equipment)}
            onSwap={swapExercise}
            canSwap={canSwap}
          />
        )}
      </div>
    );
  }

  // ── Full flow ────────────────────────────────────────────────────────
  return (
    <div className="bg-card rounded-2xl border border-line overflow-hidden shadow-[0_4px_16px_rgb(0,0,0,0.04)]">
      <div className="flex items-center gap-3 p-4">
        <div className="w-9 h-9 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
          <Brain size={17} className="text-purple-500" />
        </div>
        <p className="text-sm font-black text-fg flex-1">{t.sessionStartTitle}</p>
        {savedToday && (
          <button onClick={() => setExpanded(false)} className="text-faint hover:text-muted">
            <ChevronUp size={15} />
          </button>
        )}
      </div>

      <div className="px-4 pb-4 space-y-4">
        {/* Location chips */}
        <div>
          <div className="flex gap-1.5 flex-wrap">
            {LOCATIONS.map(({ id, labelKey }) => (
              <button
                key={id}
                onClick={() => selectLocation(id)}
                aria-pressed={location === id}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${
                  location === id
                    ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                    : 'border-line-strong text-faint hover:border-line-strong'
                }`}
              >
                {t[labelKey]}
              </button>
            ))}
          </div>
        </div>

        {location === 'rest_day' ? (
          <button
            onClick={handleRestDayConfirm}
            className="w-full py-2.5 rounded-2xl text-sm font-bold bg-purple-500 text-white hover:bg-purple-600 transition-colors"
          >
            {t.saveCheckIn}
          </button>
        ) : location ? (
          <>
            {/* Duration chips */}
            <div>
              <p className="text-xs font-black text-faint mb-2">{t.durationQuestion}</p>
              <div className="flex gap-2">
                {DURATIONS.map(({ id, labelKey }) => (
                  <button
                    key={id}
                    onClick={() => setDuration(id)}
                    aria-pressed={duration === id}
                    className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all ${
                      duration === id
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                        : 'border-line text-faint hover:border-line-strong'
                    }`}
                  >
                    {t[labelKey]}
                  </button>
                ))}
              </div>
            </div>

            {/* Equipment preset (editable) */}
            <div>
              <p className="text-xs font-black text-faint mb-2 flex items-center gap-1.5">
                <Dumbbell size={12} className="text-brand-500" />
                {t.equipmentQuestion}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  ['barbell', t.equipBarbell],
                  ['dumbbell', t.equipDumbbell],
                  ['machine', t.equipMachine],
                  ['cable', t.equipCable],
                  ['bodyweight', t.equipBodyweight],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => toggleEquipment(id)}
                    aria-pressed={equipment.includes(id)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${
                      equipment.includes(id)
                        ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                        : 'border-line-strong text-faint hover:border-line-strong'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Energy (3-level) */}
            <div>
              <p className="text-xs font-black text-faint mb-2">{t.energyQuestionShort}</p>
              <div className="flex gap-2">
                {ENERGY_LEVELS.map(({ id, labelKey }) => (
                  <button
                    key={id}
                    onClick={() => setEnergyLevel(id)}
                    aria-pressed={energyLevel === id}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                      energyLevel === id
                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                        : 'border-line text-faint hover:border-line-strong'
                    }`}
                  >
                    {t[labelKey]}
                  </button>
                ))}
              </div>
            </div>

            {/* Soreness */}
            <div>
              <p className="text-xs font-black text-faint mb-2 flex items-center gap-1.5">
                <Flame size={12} className="text-orange-400" />
                {t.sorenessLabel}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {ALL_MUSCLES.map((m) => (
                  <button
                    key={m}
                    onClick={() => toggleSoreness(m)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${
                      sorenessAreas.includes(m)
                        ? `${MUSCLE_COLORS[m]} border-current`
                        : 'border-line-strong text-faint hover:border-line-strong'
                    }`}
                  >
                    {MUSCLE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={!energyLevel}
              className="w-full py-2.5 rounded-2xl text-sm font-bold bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t.saveCheckIn}
            </button>
          </>
        ) : (
          <p className="text-xs text-faint flex items-center gap-1.5">
            <Wind size={12} />
            {lang === 'en' ? 'Pick a location to continue' : '場所を選んで続けてください'}
          </p>
        )}
      </div>

      {(planResult || planLoading || planError) && (
        <div className="px-4 pb-4">
          <GeneratedPlanCard
            result={planResult}
            loading={planLoading}
            error={planError}
            onRefresh={() => savedToday && fetchPlan(savedToday, duration, equipment)}
            onSwap={swapExercise}
            canSwap={canSwap}
          />
        </div>
      )}
    </div>
  );
}
