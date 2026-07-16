'use client';

/**
 * Symptom log page — record + display only, never diagnostic. No "this looks
 * like X", no severity color escalation; the number is shown neutrally.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Stethoscope, Trash2 } from 'lucide-react';
import {
  addSymptomEntry, removeSymptomEntry, getAllSymptomEntries,
  getFoodEntriesForDate, getWorkoutEntriesForDate, checkAndAwardBadges,
} from '@/lib/data';
import type { SymptomEntry } from '@/lib/types';
import { COMMON_SYMPTOMS, SYMPTOM_TRIGGERS, SEVERITY_MIN, SEVERITY_MAX, DURATION_MAX_MINUTES, isValidSymptomInput } from '@/lib/symptoms';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';
import { fmtShortJa } from '@/lib/format-date';
import { CARD_CLASS as cardCls } from '@/components/ui/Card';

function getTodayDate() { return new Date().toISOString().split('T')[0]; }

/** Local "now" formatted for <input type="datetime-local"> (device = JST). */
function nowLocalInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TRIGGER_LABEL_KEYS = {
  '食事': 'triggerMeal',
  '運動': 'triggerExercise',
  'ストレス': 'triggerStress',
  '天候': 'triggerWeather',
  '睡眠不足': 'triggerSleep',
  '不明': 'triggerUnknown',
} as const;

export default function SymptomsPage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<SymptomEntry[]>([]);
  const [name, setName]           = useState('');
  const [onset, setOnset]         = useState('');
  const [duration, setDuration]   = useState('');
  const [severity, setSeverity]   = useState(5);
  const [trigger, setTrigger]     = useState<string | null>(null);
  const [action, setAction]       = useState('');
  const [note, setNote]           = useState('');
  const [mealLink, setMealLink]     = useState('');
  const [workoutLink, setWorkoutLink] = useState('');
  const [todayMeals, setTodayMeals]       = useState<Array<{ id: string; name: string }>>([]);
  const [todayWorkouts, setTodayWorkouts] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    setEntries(getAllSymptomEntries());
    setOnset(nowLocalInput());
    const today = getTodayDate();
    setTodayMeals(getFoodEntriesForDate(today).map(e => ({ id: e.id, name: e.name })));
    setTodayWorkouts(getWorkoutEntriesForDate(today).map(e => ({ id: e.id, name: e.name })));
  }, []);

  // Autocomplete: common symptoms + the user's own past names.
  const nameSuggestions = useMemo(() => {
    const past = entries.map(e => e.name);
    return [...new Set([...COMMON_SYMPTOMS, ...past])];
  }, [entries]);

  const durationMin = duration.trim() === '' ? undefined : parseInt(duration, 10);
  const canSave = isValidSymptomInput({ name, severity, durationMin });

  const handleSave = async () => {
    if (!canSave) return;
    const onsetIso = onset ? new Date(onset).toISOString() : new Date().toISOString();
    const meal = todayMeals.find(m => m.id === mealLink);
    const workout = todayWorkouts.find(w => w.id === workoutLink);
    const entry: SymptomEntry = {
      id: crypto.randomUUID(),
      date: (onset || nowLocalInput()).slice(0, 10),
      onsetAt: onsetIso,
      name: name.trim(),
      durationMin,
      severity,
      trigger: trigger ?? undefined,
      actionTaken: action.trim() || undefined,
      note: note.trim() || undefined,
      relatedMealId: meal?.id,
      relatedMealName: meal?.name,
      relatedWorkoutId: workout?.id,
      relatedWorkoutName: workout?.name,
      addedAt: new Date().toISOString(),
    };
    await addSymptomEntry(entry);
    await checkAndAwardBadges(getTodayDate());
    setName(''); setDuration(''); setSeverity(5); setTrigger(null);
    setAction(''); setNote(''); setMealLink(''); setWorkoutLink('');
    setOnset(nowLocalInput());
    setEntries(getAllSymptomEntries());
  };

  const handleDelete = (id: string) => {
    void removeSymptomEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  // Date-grouped history, newest first.
  const byDate = new Map<string, SymptomEntry[]>();
  for (const e of [...entries].sort((a, b) => b.onsetAt.localeCompare(a.onsetAt))) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  const fieldCls = 'w-full px-3.5 py-2.5 rounded-2xl border border-line-strong bg-surface-2 text-fg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus:border-transparent placeholder:text-faint';
  const labelCls = 'block text-xs font-bold text-faint uppercase tracking-widest mb-1.5';

  return (
    <div className="max-w-md lg:max-w-2xl mx-auto pb-28 lg:pb-8 px-4 lg:px-6 bg-[var(--background)] min-h-screen">
      {/* ── Header ────────────────────────────── */}
      <div className="flex items-center justify-between pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-2xl">
            <Stethoscope size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-2xl font-black text-fg tracking-tight">{t.symptomsTitle}</h1>
        </div>
        <Link
          href="/report"
          className="flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 px-2.5 py-1.5 rounded-xl hover:scale-[1.04] active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          📋 {t.navReport}
        </Link>
      </div>

      {/* ── Entry form ────────────────────────── */}
      <div className={`${cardCls} p-4 mb-4 space-y-3`}>
        <div>
          <label className={labelCls} htmlFor="symptom-name">{t.symptomName}</label>
          <input id="symptom-name" type="text" value={name} onChange={(e) => setName(e.target.value)}
            list="symptom-names" placeholder="頭痛、発熱など" className={fieldCls} />
          <datalist id="symptom-names">
            {nameSuggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls} htmlFor="symptom-onset">{t.symptomOnset}</label>
            <input id="symptom-onset" type="datetime-local" value={onset}
              onChange={(e) => setOnset(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="symptom-duration">{t.symptomDuration}</label>
            <input id="symptom-duration" type="number" value={duration} min={1} max={DURATION_MAX_MINUTES}
              onChange={(e) => setDuration(e.target.value)} placeholder="30" className={fieldCls} />
          </div>
        </div>

        {/* Severity 1–10: neutral numeric display, no color escalation */}
        <div>
          <label className={labelCls} htmlFor="symptom-severity">
            {t.symptomSeverity}: <span className="text-fg text-sm font-black tabular-nums">{severity}</span> / {SEVERITY_MAX}
          </label>
          <input id="symptom-severity" type="range" min={SEVERITY_MIN} max={SEVERITY_MAX} step={1}
            value={severity} onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500" />
        </div>

        <div>
          <span className={labelCls}>{t.symptomTrigger}</span>
          <div className="flex gap-1.5 flex-wrap" role="group" aria-label={t.symptomTrigger}>
            {SYMPTOM_TRIGGERS.map((tr) => (
              <button key={tr} type="button" aria-pressed={trigger === tr}
                onClick={() => setTrigger(trigger === tr ? null : tr)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${
                  trigger === tr
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                    : 'border-line text-faint hover:border-line-strong'
                }`}>
                {t[TRIGGER_LABEL_KEYS[tr]]}
              </button>
            ))}
          </div>
        </div>

        {todayMeals.length > 0 && (
          <div>
            <label className={labelCls} htmlFor="symptom-meal">{t.symptomRelatedMeal}</label>
            <select id="symptom-meal" value={mealLink} onChange={(e) => setMealLink(e.target.value)} className={fieldCls}>
              <option value="">{t.symptomNone}</option>
              {todayMeals.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}

        {todayWorkouts.length > 0 && (
          <div>
            <label className={labelCls} htmlFor="symptom-workout">{t.symptomRelatedWorkout}</label>
            <select id="symptom-workout" value={workoutLink} onChange={(e) => setWorkoutLink(e.target.value)} className={fieldCls}>
              <option value="">{t.symptomNone}</option>
              {todayWorkouts.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className={labelCls} htmlFor="symptom-action">{t.symptomAction}</label>
          <input id="symptom-action" type="text" value={action} onChange={(e) => setAction(e.target.value)}
            placeholder="薬を飲んだ、休んだなど" className={fieldCls} />
        </div>

        <div>
          <label className={labelCls} htmlFor="symptom-note">{t.symptomNote}</label>
          <textarea id="symptom-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className={`${fieldCls} resize-none`} />
        </div>

        <button type="button" onClick={() => void handleSave()} disabled={!canSave}
          className={`
            w-full py-3.5 rounded-2xl font-black text-sm text-white
            transition-all duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
            ${canSave
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-[0_4px_14px_rgba(245,158,11,0.4)] hover:scale-[1.01] active:scale-[0.98]'
              : 'bg-surface-2 text-faint cursor-not-allowed'}
          `}>
          {t.symptomSave}
        </button>
      </div>

      {/* ── History ───────────────────────────── */}
      <h2 className="text-sm font-bold text-muted mb-3 mt-1">{t.symptomHistory}</h2>

      {entries.length === 0 ? (
        <div className={`${cardCls} p-10 text-center`}>
          <p className="text-4xl mb-3" aria-hidden="true">📝</p>
          <p className="text-sm font-semibold text-faint mb-4">{t.noSymptoms}</p>
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              document.getElementById('symptom-name')?.focus({ preventScroll: true });
            }}
            className="
              inline-flex items-center justify-center
              px-5 py-2.5 rounded-2xl
              bg-gradient-to-br from-brand-500 to-brand-600 text-white
              text-sm font-bold
              shadow-card hover:scale-[1.03] active:scale-95
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
              transition-all duration-200
            "
          >
            {t.noSymptomsCta}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {dates.map((date) => (
            <div key={date}>
              <p className="text-xs font-black text-faint uppercase tracking-widest mb-1.5 px-1">
                {fmtShortJa(date)}
              </p>
              <div className="space-y-2">
                {(byDate.get(date) ?? []).map((e) => (
                  <div key={e.id} className={`${cardCls} p-3 flex items-start justify-between gap-2`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-fg">
                        {e.name}
                        <span className="ml-2 text-xs font-bold text-muted bg-surface-2 px-2 py-0.5 rounded-full tabular-nums">
                          {t.symptomSeverity} {e.severity}/10
                        </span>
                      </p>
                      <p className="text-xs text-faint mt-0.5">
                        {new Date(e.onsetAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                        {e.durationMin != null && ` · ${e.durationMin}分`}
                        {e.trigger && ` · ${t[TRIGGER_LABEL_KEYS[e.trigger as keyof typeof TRIGGER_LABEL_KEYS]] ?? e.trigger}`}
                      </p>
                      {(e.relatedMealName || e.relatedWorkoutName) && (
                        <p className="text-xs text-faint mt-0.5">
                          {e.relatedMealName && `🥗 ${e.relatedMealName}`}
                          {e.relatedMealName && e.relatedWorkoutName && ' · '}
                          {e.relatedWorkoutName && `🏋️ ${e.relatedWorkoutName}`}
                        </p>
                      )}
                      {e.actionTaken && <p className="text-xs text-muted mt-0.5">💊 {e.actionTaken}</p>}
                      {e.note && <p className="text-xs text-faint mt-0.5 truncate">{e.note}</p>}
                    </div>
                    <button type="button" onClick={() => handleDelete(e.id)}
                      aria-label={`${e.name} の記録を削除`}
                      className="p-2 text-faint hover:text-red-400 active:scale-95 transition-all duration-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Non-diagnostic footer ─────────────── */}
      <p className="text-xs text-faint leading-relaxed mt-6 px-1">{t.vitalsDisclaimer}</p>

      <BottomNav />
    </div>
  );
}
