'use client';

/**
 * One-row weight logger on the dashboard (ADR-011 core loop).
 *
 * The input starts EMPTY, with the latest weight only as a placeholder: a
 * prefilled value saved with one tap would store an unmeasured weight
 * (ADR-008 B6). Logging = focus + type + tap. Same-day entries replace the
 * earlier one (lib/storage.ts addWeightEntry), so re-logging is safe.
 */

import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { addWeightEntry, getLatestWeightEntry } from '@/lib/data';
import { fmtShortJa, todayJst } from '@/lib/format-date';
import { useLanguage } from '@/contexts/LanguageContext';
import type { WeightEntry } from '@/lib/types';
import { MIN_WEIGHT_KG, MAX_WEIGHT_KG, isValidWeightKg } from '@/lib/weight-bounds';

export default function QuickWeightCard({ onSaved }: { onSaved?: () => void } = {}) {
  const { t } = useLanguage();
  const [latest, setLatest] = useState<WeightEntry | undefined>();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedToday, setSavedToday] = useState(false);

  useEffect(() => {
    const last = getLatestWeightEntry();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only read on mount
    setLatest(last);
  }, []);

  const today = todayJst();
  const loggedToday = latest?.date === today;

  const handleSave = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const val = Number(input);
    if (!isValidWeightKg(val)) {
      setError(t.quickWeightInvalid);
      return;
    }
    setError(null);
    const entry: WeightEntry = {
      id: crypto.randomUUID(),
      date: today,
      weight: Math.round(val * 10) / 10,
      addedAt: new Date().toISOString(),
    };
    await addWeightEntry(entry);
    setLatest(entry);
    setSavedToday(true);
    onSaved?.();
  };

  return (
    <form
      data-testid="quick-weight"
      onSubmit={(e) => void handleSave(e)}
      className="bg-card rounded-2xl shadow-card border border-line p-4 mb-3"
    >
      <div className="flex items-center justify-between mb-2">
        <label htmlFor="quick-weight-input" className="flex items-center gap-1.5 text-sm font-bold text-muted">
          <Scale size={16} className="text-indigo-500" aria-hidden="true" />
          {t.quickWeightLabel}
        </label>
        {latest && (
          <span className="text-[11px] text-faint tabular-nums" role={savedToday ? 'status' : undefined}>
            {loggedToday
              ? t.quickWeightToday.replace('{w}', String(latest.weight))
              : t.quickWeightLast.replace('{w}', String(latest.weight)).replace('{d}', fmtShortJa(latest.date))}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id="quick-weight-input"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={MIN_WEIGHT_KG}
            max={MAX_WEIGHT_KG}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={latest ? String(latest.weight) : '65.0'}
            aria-invalid={error !== null}
            aria-describedby={error ? 'quick-weight-error' : undefined}
            className="w-full px-3 py-2.5 pr-10 rounded-xl border border-line-strong bg-surface-2 text-fg text-base font-bold tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint" aria-hidden="true">kg</span>
        </div>
        <button
          type="submit"
          className="px-5 min-h-11 rounded-xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500"
        >
          {t.quickWeightSave}
        </button>
      </div>
      {error && <p id="quick-weight-error" className="text-xs text-danger mt-1.5">{error}</p>}
      {savedToday && !error && <p className="text-xs text-brand mt-1.5" role="status">{t.quickWeightSaved}</p>}
    </form>
  );
}
