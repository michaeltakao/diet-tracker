'use client';

/**
 * Vitals logging page (BP / blood glucose).
 *
 * Hard constraint: RECORD ONLY. Values are displayed neutrally — no verdicts,
 * no threshold colors, no interpretation. The disclaimer footer points users
 * to healthcare providers for any concerns.
 */

import { useEffect, useRef, useState } from 'react';
import { HeartPulse, Trash2, Droplet } from 'lucide-react';
import { addVitalEntry, removeVitalEntry, getAllVitalEntries, checkAndAwardBadges } from '@/lib/data';
import type { VitalEntry, GlucoseContext } from '@/lib/types';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';
import { fmtShortJa } from '@/lib/format-date';
import { CARD_CLASS as cardCls } from '@/components/ui/Card';

function getTodayDate() { return new Date().toISOString().split('T')[0]; }

type VitalKind = 'blood_pressure' | 'blood_glucose';

// Client-side bounds mirror the SQL CHECKs (wide plausibility, not judgement).
const BOUNDS = {
  systolic:  { min: 50, max: 300 },
  diastolic: { min: 30, max: 200 },
  glucose:   { min: 20, max: 600 },
} as const;

export default function VitalsPage() {
  const { t } = useLanguage();
  const [entries, setEntries]   = useState<VitalEntry[]>([]);
  const [kind, setKind]         = useState<VitalKind>('blood_pressure');
  const [systolic, setSystolic]   = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [glucose, setGlucose]     = useState('');
  const [glucoseContext, setGlucoseContext] = useState<GlucoseContext>('fasting');
  const [notes, setNotes]         = useState('');
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const load = () => setEntries(getAllVitalEntries());
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
  useEffect(() => { load(); }, []);

  const inBounds = (v: number, b: { min: number; max: number }) =>
    Number.isFinite(v) && v >= b.min && v <= b.max;

  const canSave = kind === 'blood_pressure'
    ? inBounds(parseFloat(systolic), BOUNDS.systolic) && inBounds(parseFloat(diastolic), BOUNDS.diastolic)
    : inBounds(parseFloat(glucose), BOUNDS.glucose);

  const handleSave = async () => {
    if (!canSave) return;
    const base = {
      id: crypto.randomUUID(),
      date: getTodayDate(),
      addedAt: new Date().toISOString(),
      notes: notes.trim() || undefined,
    };
    const entry: VitalEntry = kind === 'blood_pressure'
      ? { ...base, kind, systolic: Math.round(parseFloat(systolic)), diastolic: Math.round(parseFloat(diastolic)) }
      : { ...base, kind, glucoseMgDl: Math.round(parseFloat(glucose)), glucoseContext };
    await addVitalEntry(entry);
    await checkAndAwardBadges(getTodayDate());
    setSystolic(''); setDiastolic(''); setGlucose(''); setNotes('');
    load();
  };

  const handleDelete = (id: string) => { void removeVitalEntry(id); setEntries(prev => prev.filter(e => e.id !== id)); };

  // Date-grouped history, newest date first, newest measurement first inside a day.
  const byDate = new Map<string, VitalEntry[]>();
  for (const e of [...entries].sort((a, b) => b.addedAt.localeCompare(a.addedAt))) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  const inputCls = `
    w-full px-3.5 py-3 rounded-2xl
    border border-line-strong bg-surface-2 text-fg
    text-lg font-bold tabular-nums
    focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus:border-transparent
    placeholder:text-faint
  `;

  const segBtn = (active: boolean) => `
    flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
    ${active ? 'bg-rose-500 text-white shadow-[0_4px_12px_rgba(244,63,94,0.35)]' : 'bg-surface-2 text-muted hover:text-fg'}
  `;

  return (
    <div className="max-w-md lg:max-w-2xl mx-auto pb-28 lg:pb-8 px-4 lg:px-6 bg-[var(--background)] min-h-screen">
      {/* ── Header ────────────────────────────── */}
      <div className="flex items-center gap-2.5 pt-6 pb-5">
        <div className="p-2 bg-rose-50 dark:bg-rose-900/30 rounded-2xl">
          <HeartPulse size={20} className="text-rose-500" />
        </div>
        <h1 className="text-2xl font-black text-fg tracking-tight">{t.vitalsTitle}</h1>
      </div>

      {/* ── Entry form ────────────────────────── */}
      <div className={`${cardCls} p-4 mb-4`}>
        {/* Kind toggle */}
        <div className="flex gap-2 mb-4" role="tablist" aria-label={t.vitalsTitle}>
          <button type="button" role="tab" aria-selected={kind === 'blood_pressure'}
            onClick={() => setKind('blood_pressure')} className={segBtn(kind === 'blood_pressure')}>
            🫀 {t.vitalsBp}
          </button>
          <button type="button" role="tab" aria-selected={kind === 'blood_glucose'}
            onClick={() => setKind('blood_glucose')} className={segBtn(kind === 'blood_glucose')}>
            <Droplet size={12} className="inline -mt-0.5 mr-0.5" aria-hidden="true" />{t.vitalsGlucose}
          </button>
        </div>

        {kind === 'blood_pressure' ? (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-xs font-bold text-faint uppercase tracking-widest mb-1.5">{t.systolicLabel}</label>
              <input ref={firstInputRef} type="number" value={systolic} onChange={(e) => setSystolic(e.target.value)}
                placeholder="120" min={BOUNDS.systolic.min} max={BOUNDS.systolic.max}
                aria-label={t.systolicLabel} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-faint uppercase tracking-widest mb-1.5">{t.diastolicLabel}</label>
              <input type="number" value={diastolic} onChange={(e) => setDiastolic(e.target.value)}
                placeholder="80" min={BOUNDS.diastolic.min} max={BOUNDS.diastolic.max}
                aria-label={t.diastolicLabel} className={inputCls} />
            </div>
          </div>
        ) : (
          <div className="mb-3 space-y-3">
            <div>
              <label className="block text-xs font-bold text-faint uppercase tracking-widest mb-1.5">{t.glucoseLabel}</label>
              <input type="number" value={glucose} onChange={(e) => setGlucose(e.target.value)}
                placeholder="100" min={BOUNDS.glucose.min} max={BOUNDS.glucose.max}
                aria-label={t.glucoseLabel} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-faint uppercase tracking-widest mb-1.5">{t.glucoseContextLabel}</label>
              <div className="flex gap-1.5" role="radiogroup" aria-label={t.glucoseContextLabel}>
                {([
                  ['fasting', t.glucoseFasting],
                  ['postprandial', t.glucosePostprandial],
                  ['random', t.glucoseRandom],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" role="radio" aria-checked={glucoseContext === value}
                    onClick={() => setGlucoseContext(value)}
                    className={`
                      flex-1 px-2 py-2 rounded-xl text-xs font-bold transition-all duration-200
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                      ${glucoseContext === value ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 border border-rose-300 dark:border-rose-700' : 'bg-surface-2 text-muted border border-transparent'}
                    `}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mb-3">
          <label className="block text-xs font-bold text-faint uppercase tracking-widest mb-1.5">{t.vitalsNotes}</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            aria-label={t.vitalsNotes}
            className="w-full px-3.5 py-2.5 rounded-2xl border border-line-strong bg-surface-2 text-fg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus:border-transparent placeholder:text-faint" />
        </div>

        <button type="button" onClick={() => void handleSave()} disabled={!canSave}
          className={`
            w-full py-3.5 rounded-2xl font-black text-sm text-white
            transition-all duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
            ${canSave
              ? 'bg-gradient-to-r from-rose-500 to-pink-600 shadow-[0_4px_14px_rgba(244,63,94,0.4)] hover:scale-[1.01] active:scale-[0.98]'
              : 'bg-surface-2 text-faint cursor-not-allowed'}
          `}>
          {t.vitalsSave}
        </button>
      </div>

      {/* ── History ───────────────────────────── */}
      <h2 className="text-sm font-bold text-muted mb-3 mt-1">{t.vitalsHistory}</h2>

      {entries.length === 0 ? (
        <div className={`${cardCls} p-10 text-center`}>
          <p className="text-4xl mb-3" aria-hidden="true">🩺</p>
          <p className="text-sm font-semibold text-faint mb-4">{t.noVitals}</p>
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              firstInputRef.current?.focus({ preventScroll: true });
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
            {t.noVitalsCta}
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
                  <div key={e.id} className={`${cardCls} p-3 flex items-center justify-between`}>
                    <div className="min-w-0">
                      {e.kind === 'blood_pressure' ? (
                        <p className="text-sm font-bold text-fg tabular-nums">
                          🫀 {e.systolic} / {e.diastolic} <span className="text-xs text-faint font-medium">mmHg</span>
                        </p>
                      ) : (
                        <p className="text-sm font-bold text-fg tabular-nums">
                          🩸 {e.glucoseMgDl} <span className="text-xs text-faint font-medium">mg/dL ·{' '}
                            {e.glucoseContext === 'fasting' ? t.glucoseFasting
                              : e.glucoseContext === 'postprandial' ? t.glucosePostprandial
                              : t.glucoseRandom}</span>
                        </p>
                      )}
                      {e.notes && <p className="text-xs text-faint mt-0.5 truncate">{e.notes}</p>}
                      <p className="text-[10px] text-faint mt-0.5">
                        {new Date(e.addedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button type="button" onClick={() => handleDelete(e.id)}
                      aria-label={`${fmtShortJa(e.date)} の記録を削除`}
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

      {/* ── Disclaimer (record only, never interpret) ── */}
      <p className="text-xs text-faint leading-relaxed mt-6 px-1">{t.vitalsDisclaimer}</p>

      <BottomNav />
    </div>
  );
}
