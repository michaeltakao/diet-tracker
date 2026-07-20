'use client';

/**
 * AI nutritionist dashboard widget: on-demand, exactly-3 suggestions for
 * improving TODAY's already-logged meals (server: /api/nutritionist).
 * Gated behind real goals (P0 #4b) — renders nothing without them; with
 * goals but no meals it shows an empty hint instead of the generate button.
 */

import { useEffect, useState } from 'react';
import { ChefHat, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { getFoodEntriesForDate, getRealGoals } from '@/lib/data';
import { postJson } from '@/lib/httpClient';
import { useLanguage } from '@/contexts/LanguageContext';
import type { FoodEntry, DailyGoals } from '@/lib/types';

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

interface Suggestion {
  title: string;
  detail: string;
}

export function NutritionistCard() {
  const { t } = useLanguage();
  const [entries, setEntries]         = useState<FoodEntry[]>([]);
  const [goals, setGoals]             = useState<DailyGoals | null>(null);
  const [ready, setReady]             = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    setEntries(getFoodEntriesForDate(getTodayDate()));
    setGoals(getRealGoals());
    setReady(true);
  }, []);

  // No card before hydration or without real goals (never send fabricated
  // defaults to the LLM — same stance as RecommendationCard).
  if (!ready || !goals) return null;

  const generate = async () => {
    if (loading || entries.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await postJson<{ suggestions: Suggestion[] }>('/api/nutritionist', {
        entries: entries.map((e) => ({
          name: e.name,
          calories: e.calories,
          protein: e.protein,
          fat: e.fat,
          carbs: e.carbs,
          ...(e.sodiumMg != null ? { sodiumMg: e.sodiumMg } : {}),
          ...(e.fiberG != null ? { fiberG: e.fiberG } : {}),
        })),
        goals: {
          calories: goals.calories,
          protein: goals.protein,
          fat: goals.fat,
          carbs: goals.carbs,
        },
      });
      setSuggestions(res.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.aiSuggestionFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl shadow-card border border-line p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-muted flex items-center gap-1.5">
          <ChefHat size={15} className="text-brand-600 dark:text-brand-400" aria-hidden="true" />
          {t.nutritionistTitle}
        </h2>
        {suggestions && (
          <button
            onClick={() => void generate()}
            disabled={loading}
            aria-label={t.nutritionistButton}
            className="p-1.5 rounded-lg text-faint hover:text-fg disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : undefined} aria-hidden="true" />
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl p-3 text-xs mb-2">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-xs text-faint py-1">{t.nutritionistEmpty}</p>
      ) : suggestions ? (
        <ol className="space-y-2.5">
          {suggestions.map((s, i) => (
            <li key={i} className="flex gap-2.5">
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-[10px] font-black flex items-center justify-center mt-0.5"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-bold text-fg leading-tight">{s.title}</p>
                <p className="text-xs text-muted mt-0.5">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <button
          onClick={() => void generate()}
          disabled={loading}
          className="
            w-full py-2.5 rounded-xl text-sm font-semibold
            bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white
            transition-colors flex items-center justify-center gap-2
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
          "
        >
          {loading
            ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            : <ChefHat size={16} aria-hidden="true" />}
          {t.nutritionistButton}
        </button>
      )}
    </div>
  );
}
