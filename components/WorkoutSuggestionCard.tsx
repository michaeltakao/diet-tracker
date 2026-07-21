'use client';

/**
 * AI training-session suggestion card. Extracted from app/plan/page.tsx
 * (P0 #9, FTUE roadmap) so /workout's SessionStart flow can render the same
 * card without a dependency on the /plan page.
 */

import { Zap, RefreshCw, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { WorkoutSuggestion } from '@/lib/types';

const PROCEED_STYLES_BG: Record<string, { bg: string; text: string }> = {
  full:        { bg: 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800', text: 'text-brand-700 dark:text-brand-300' },
  reduced:     { bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300' },
  alternative: { bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',    text: 'text-blue-700 dark:text-blue-300'  },
  rest:        { bg: 'bg-surface-2 border-line',     text: 'text-muted'  },
};

export default function WorkoutSuggestionCard({
  suggestion,
  loading,
  error,
  onRefresh,
}: {
  suggestion: WorkoutSuggestion | null;
  loading: boolean;
  error: 'auth' | 'error' | null;
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  const PROCEED_STYLES = {
    full:        { ...PROCEED_STYLES_BG.full,        label: t.proceedFull },
    reduced:     { ...PROCEED_STYLES_BG.reduced,     label: t.proceedReduced },
    alternative: { ...PROCEED_STYLES_BG.alternative, label: t.proceedAlternative },
    rest:        { ...PROCEED_STYLES_BG.rest,         label: t.proceedRest },
  } as Record<string, { bg: string; text: string; label: string }>;
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
            <div key={i} className={`h-3 bg-surface-2 rounded-full animate-pulse`} style={{ width: `${w}%` }} />
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
        <button onClick={onRefresh} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-500 text-xs font-bold hover:bg-red-200 transition-colors">
          <RefreshCw size={12} />
          再試行
        </button>
      </div>
    );
  }

  if (!suggestion) return null;

  const style = PROCEED_STYLES[suggestion.proceed] ?? PROCEED_STYLES.full;

  return (
    <div className={`rounded-2xl border p-4 ${style.bg} shadow-[0_4px_16px_rgb(0,0,0,0.04)]`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-card/60 flex items-center justify-center shrink-0">
            <Zap size={17} className={style.text} />
          </div>
          <div>
            <p className={`text-xs font-black uppercase tracking-widest ${style.text} opacity-60`}>{t.aiSuggestionLabel}</p>
            <p className={`text-base font-black ${style.text}`}>{style.label}</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl hover:bg-card/50 transition-colors"
          title="再生成"
        >
          <RefreshCw size={14} className={style.text} />
        </button>
      </div>

      {/* Session name */}
      <p className={`text-sm font-bold ${style.text} mb-2`}>{suggestion.sessionName}</p>

      {/* Intensity note */}
      <p className={`text-xs ${style.text} opacity-80 mb-3 bg-card/40 px-3 py-2 rounded-xl`}>
        {suggestion.intensityNote}
      </p>

      {/* Adjustments */}
      {suggestion.adjustments.length > 0 && (
        <div className="mb-3">
          <p className={`text-xs font-black uppercase tracking-widest ${style.text} opacity-50 mb-1.5`}>{t.adjustmentsLabel}</p>
          <div className="space-y-1">
            {suggestion.adjustments.map((adj, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle size={11} className={`${style.text} opacity-60 mt-0.5 shrink-0`} />
                <p className={`text-xs ${style.text} opacity-80`}>{adj}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recovery tips */}
      {suggestion.recoveryTips.length > 0 && (
        <div className="mb-3">
          <p className={`text-xs font-black uppercase tracking-widest ${style.text} opacity-50 mb-1.5`}>{t.recoveryLabel}</p>
          <div className="space-y-1">
            {suggestion.recoveryTips.map((tip, i) => (
              <p key={i} className={`text-xs ${style.text} opacity-80`}>• {tip}</p>
            ))}
          </div>
        </div>
      )}

      {/* Motivation */}
      <div className={`border-t border-current border-opacity-10 pt-3`}>
        <p className={`text-sm font-black ${style.text}`}>{suggestion.motivationMessage}</p>
      </div>
    </div>
  );
}
