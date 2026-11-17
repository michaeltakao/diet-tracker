'use client';

/**
 * Workout log — deliberately minimal (ADR-011).
 *
 * The study's outcome is workout DAYS per week, so the page only has to make
 * "I trained today" cheap to record: exercise name (suggested from the
 * exercise DB + history), body part, and optional weight × reps × sets.
 * The program generator, AI coach, session-start check-in, rest timer, PR
 * badges, combos and per-exercise ranks were deleted; git history has them.
 *
 * Safety layer kept: medication / condition workout warnings (MedWarning).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dumbbell, Trash2 } from 'lucide-react';
import { getAppData, addWorkoutEntry, removeWorkoutEntry, getHealthProfile } from '@/lib/data';
import { getWorkoutWarnings } from '@/lib/medication-rules';
import { EXERCISE_DB } from '@/lib/exercise-db';
import type { MusclePart, WorkoutEntry } from '@/lib/types';
import MedWarning from '@/components/MedWarning';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWeightUnit, lbsToKg, formatWeight } from '@/lib/units';
import { todayJst } from '@/lib/format-date';

const PART_IDS: MusclePart[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs'];

const FIELD = 'w-full px-3 py-2.5 rounded-xl border border-line-strong bg-surface-2 text-fg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]';

export default function WorkoutPage() {
  const { t, lang } = useLanguage();
  const { unit } = useWeightUnit();
  const today = todayJst();

  const [todayEntries, setTodayEntries] = useState<WorkoutEntry[]>([]);
  const [history, setHistory]           = useState<WorkoutEntry[]>([]);
  const [warnings, setWarnings]         = useState<string[]>([]);
  const [name, setName]                 = useState('');
  const [part, setPart]                 = useState<MusclePart>('chest');
  const [weight, setWeight]             = useState('');
  const [reps, setReps]                 = useState('');
  const [sets, setSets]                 = useState('');

  const load = useCallback(() => {
    const data = getAppData();
    setTodayEntries(data.workoutEntries.filter((w) => w.date === today));
    setHistory(data.workoutEntries);
    const profile = getHealthProfile();
    setWarnings(getWorkoutWarnings(profile.healthConditions, profile.medications ?? []));
  }, [today]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
  useEffect(() => { load(); }, [load]);

  /** Recently used names first, then the exercise DB (deduplicated). */
  const suggestions = useMemo(() => {
    const recent = [...history]
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
      .map((w) => w.name);
    // nameJa is the canonical logging name (lib/exercise-db.ts) in both languages.
    const db = EXERCISE_DB.map((e) => e.nameJa);
    return Array.from(new Set([...recent, ...db])).slice(0, 80);
  }, [history]);

  /** Picking a known exercise fills its body part. */
  const onNameChange = (value: string) => {
    setName(value);
    const known = EXERCISE_DB.find((e) => e.nameJa === value)
      ?? history.find((w) => w.name === value);
    if (known?.musclePart) setPart(known.musclePart);
  };

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const w = parseFloat(weight);
    const kg = Number.isFinite(w) && w > 0
      ? (unit === 'lbs' ? Math.round(lbsToKg(w) * 10) / 10 : w)
      : undefined;
    const r = parseInt(reps, 10);
    const s = parseInt(sets, 10);
    await addWorkoutEntry({
      id: crypto.randomUUID(),
      date: today,
      name: trimmed,
      category: 'strength',
      musclePart: part,
      ...(kg !== undefined ? { weight: kg } : {}),
      ...(Number.isFinite(r) && r > 0 ? { reps: r } : {}),
      ...(Number.isFinite(s) && s > 0 ? { sets: s } : {}),
      addedAt: new Date().toISOString(),
    });
    setName('');
    setWeight('');
    setReps('');
    setSets('');
    load();
  };

  const handleDelete = (id: string) => { void removeWorkoutEntry(id); load(); };

  const partLabel = (id: MusclePart) =>
    t[`mp${id.charAt(0).toUpperCase()}${id.slice(1)}` as 'mpChest'];

  return (
    <main className="min-h-screen bg-[var(--background)] pb-28 lg:pb-8 max-w-md lg:max-w-2xl mx-auto px-4 lg:px-6">
      <div className="pt-6 pb-4">
        <h1 className="text-2xl font-black text-fg tracking-tight flex items-center gap-2">
          <Dumbbell className="w-6 h-6 text-brand" aria-hidden="true" /> {t.workoutLog}
        </h1>
        <p className="text-xs text-faint mt-0.5">{t.workoutSubtitle}</p>
      </div>

      {warnings.length > 0 && (
        <div className="mb-3">
          <MedWarning warnings={warnings} type="workout" collapseAfter={2} />
        </div>
      )}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="bg-card rounded-2xl shadow-card border border-line p-4 mb-4 space-y-3"
      >
        <div>
          <label htmlFor="workout-name" className="block text-xs font-bold text-faint mb-1.5">{t.workoutName}</label>
          <input
            id="workout-name"
            list="workout-suggestions"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={lang === 'en' ? 'e.g. Squat, 30 min walk' : '例：スクワット、ウォーキング30分'}
            autoComplete="off"
            className={FIELD}
          />
          <datalist id="workout-suggestions">
            {suggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>

        <div>
          <span className="block text-xs font-bold text-faint mb-1.5">{t.musclePartLabel}</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t.musclePartLabel}>
            {PART_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={part === id}
                onClick={() => setPart(id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                  part === id ? 'bg-brand-500 text-white' : 'bg-surface-2 text-muted hover:bg-line'
                }`}
              >
                {partLabel(id)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="workout-weight" className="block text-[11px] font-bold text-faint mb-1">
              {lang === 'en' ? `Weight (${unit})` : `重量 (${unit})`}
            </label>
            <input id="workout-weight" type="number" inputMode="decimal" min="0" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="—" className={FIELD} />
          </div>
          <div>
            <label htmlFor="workout-reps" className="block text-[11px] font-bold text-faint mb-1">{t.reps}</label>
            <input id="workout-reps" type="number" inputMode="numeric" min="0" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="—" className={FIELD} />
          </div>
          <div>
            <label htmlFor="workout-sets" className="block text-[11px] font-bold text-faint mb-1">{t.sets}</label>
            <input id="workout-sets" type="number" inputMode="numeric" min="0" value={sets} onChange={(e) => setSets(e.target.value)} placeholder="—" className={FIELD} />
          </div>
        </div>

        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full py-3 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600 disabled:opacity-40 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]"
        >
          {t.saveWorkout}
        </button>
      </form>

      <h2 className="text-sm font-bold text-muted mb-2">{lang === 'en' ? 'Today' : '今日の記録'}</h2>
      {todayEntries.length === 0 ? (
        <p className="text-sm text-faint bg-card rounded-2xl border border-line p-6 text-center">{t.noWorkouts}</p>
      ) : (
        <ul className="space-y-2">
          {todayEntries.map((w) => (
            <li key={w.id} className="bg-card rounded-2xl border border-line shadow-card px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-fg truncate">{w.name}</p>
                <p className="text-xs text-faint tabular-nums">
                  {w.musclePart ? partLabel(w.musclePart) : ''}
                  {w.weight ? ` · ${formatWeight(w.weight, unit)}` : ''}
                  {w.reps ? ` × ${w.reps}` : ''}
                  {w.sets ? ` × ${w.sets}${lang === 'en' ? ' sets' : 'セット'}` : ''}
                </p>
              </div>
              <button
                onClick={() => handleDelete(w.id)}
                aria-label={`${t.delete}: ${w.name}`}
                className="p-2 rounded-xl text-faint hover:text-danger hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <BottomNav />
    </main>
  );
}
