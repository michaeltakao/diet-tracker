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
 * for tomorrow's default), and fetches an AI suggestion — the same
 * fetchSuggestion logic that used to live in app/plan/page.tsx, now sending
 * location + duration alongside the existing fields.
 *
 * If today's check-in is already saved, renders a collapsed summary with a
 * "change" affordance that re-expands the full flow.
 */

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
import { getGoals } from '@/lib/data/profile';
import { getAllPersonalRecords, getWorkoutEntriesForRange } from '@/lib/data/workout';
import { getTodaySession } from '@/lib/data/training-plan';
import {
  energyLevelToScale, pickDefaultLocation, LOCATION_EQUIPMENT_DEFAULTS,
  type EnergyLevel,
} from '@/lib/session-start';
import type { Equipment } from '@/lib/exercise-db';
import type { DailyCheckIn, WorkoutSuggestion, MusclePart } from '@/lib/types';
import WorkoutSuggestionCard from '@/components/WorkoutSuggestionCard';
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

  const [suggestion, setSuggestion]           = useState<WorkoutSuggestion | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError]     = useState<'auth' | 'error' | null>(null);

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

  const fetchSuggestion = useCallback(async (ci: DailyCheckIn, loc?: TrainingLocation, dur?: SessionDuration) => {
    if (!ci.mood || !ci.energy) return;
    setSuggestionLoading(true);
    setSuggestion(null);
    setSuggestionError(null);
    try {
      const session = getTodaySession();
      const profile = getHealthProfile();
      const goals   = getGoals();
      const prs     = getAllPersonalRecords();

      const end   = today;
      const start = (() => {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();
      const recentWorkouts = getWorkoutEntriesForRange(start, end).map(e => ({
        date: e.date, name: e.name, musclePart: e.musclePart,
      }));
      const personalRecords = Object.values(prs).map(r => ({
        name: r.exerciseName, weight: r.maxWeight, date: r.date,
      }));

      const body = {
        today,
        checkIn: {
          mood:          ci.mood,
          energy:        ci.energy,
          sleepHours:    ci.sleepHours,
          sorenessAreas: ci.sorenessAreas,
          notes:         ci.notes,
        },
        plannedSession: session ? {
          name:      session.name,
          exercises: session.exercises.map(e => ({
            name: e.name, musclePart: e.musclePart,
            sets: e.sets, repsMin: e.repsMin, repsMax: e.repsMax,
            targetWeight: e.targetWeight,
          })),
        } : null,
        fitnessGoal:      profile.fitnessGoal,
        targetWeight:     goals.goalWeight,
        recentWorkouts,
        personalRecords,
        healthConditions: profile.healthConditions,
        medications:      profile.medications ?? [],
        location:  loc,
        duration:  dur,
        equipment: equipment.length > 0 ? equipment : undefined,
      };

      const data = await postJson<WorkoutSuggestion>('/api/suggest-workout', body);
      setSuggestion({
        ...data,
        adjustments:  Array.isArray(data.adjustments)  ? data.adjustments  : [],
        recoveryTips: Array.isArray(data.recoveryTips) ? data.recoveryTips : [],
      });
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) {
        setSuggestionError('auth');
      } else {
        setSuggestionError('error');
      }
    } finally {
      setSuggestionLoading(false);
    }
  }, [today, equipment]);

  // Auto-fetch suggestion when a check-in for today already exists (page reload mid-flow).
  useEffect(() => {
    if (!loaded || !savedToday) return;
    if (savedToday.mood && savedToday.energy) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot auto-fetch when a saved check-in already exists
      fetchSuggestion(savedToday, location, duration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on load, not on every location/duration edit
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
    fetchSuggestion(ci, location, duration);
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
        {(suggestion || suggestionLoading || suggestionError) && (
          <WorkoutSuggestionCard
            suggestion={suggestion}
            loading={suggestionLoading}
            error={suggestionError}
            onRefresh={() => savedToday && fetchSuggestion(savedToday, location, duration)}
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

      {(suggestion || suggestionLoading || suggestionError) && (
        <div className="px-4 pb-4">
          <WorkoutSuggestionCard
            suggestion={suggestion}
            loading={suggestionLoading}
            error={suggestionError}
            onRefresh={() => savedToday && fetchSuggestion(savedToday, location, duration)}
          />
        </div>
      )}
    </div>
  );
}
