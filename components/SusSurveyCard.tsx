'use client';

/**
 * SUS (System Usability Scale) survey card (FTUE roadmap P0 #10, Day-14+
 * gate). Mounted on /log directly after WeeklyReportCard, authenticated
 * users only. Gate logic lives in lib/sus-gate.ts (pure/DI); this component
 * supplies the clock (jstToday) and localStorage-backed dismiss state,
 * mirroring the NudgeBanner idiom (components/NudgeBanner.tsx).
 *
 * consented_at is read from ProfileContext's already-fetched profile row
 * (select('*') in fetchProfile) — no new API call needed to gate display.
 * Submission itself goes through POST /api/sus, which computes total_score
 * server-side; the client only sends the 10 raw item scores.
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { jstToday } from '@/lib/streak';
import { decideSusShow } from '@/lib/sus-gate';
import { postJson, HttpError } from '@/lib/httpClient';
import { Button } from '@/components/ui/Button';
import type { TranslationKey } from '@/lib/i18n';

const DISMISS_DAY_KEY = 'diet-tracker-sus-dismissed-day';
const DISMISS_COUNT_KEY = 'diet-tracker-sus-dismiss-count';
const SUBMITTED_KEY = 'diet-tracker-sus-submitted';

const ITEM_KEYS = [
  'item1', 'item2', 'item3', 'item4', 'item5',
  'item6', 'item7', 'item8', 'item9', 'item10',
] as const;

const ITEM_LABEL_KEYS: Record<(typeof ITEM_KEYS)[number], TranslationKey> = {
  item1: 'susItem1', item2: 'susItem2', item3: 'susItem3', item4: 'susItem4', item5: 'susItem5',
  item6: 'susItem6', item7: 'susItem7', item8: 'susItem8', item9: 'susItem9', item10: 'susItem10',
};

const LIKERT_KEYS: readonly TranslationKey[] = [
  'susLikert1', 'susLikert2', 'susLikert3', 'susLikert4', 'susLikert5',
];

type ItemScores = Record<(typeof ITEM_KEYS)[number], number | null>;

function emptyScores(): ItemScores {
  return {
    item1: null, item2: null, item3: null, item4: null, item5: null,
    item6: null, item7: null, item8: null, item9: null, item10: null,
  };
}

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable — state simply doesn't persist across reloads
  }
}

export default function SusSurveyCard() {
  const { t } = useLanguage();
  const { profile, isAuthenticated } = useProfile();
  const [visible, setVisible] = useState(false);
  const [scores, setScores] = useState<ItemScores>(emptyScores());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !profile) return;
    const alreadySubmitted = readLocal(SUBMITTED_KEY) === '1';
    const decision = decideSusShow({
      consentedAt: profile.consented_at,
      today: jstToday(),
      alreadySubmitted,
      dismissCount: Number(readLocal(DISMISS_COUNT_KEY) ?? '0'),
      lastDismissedDay: readLocal(DISMISS_DAY_KEY),
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only localStorage read on mount
    setVisible(decision.show);
  }, [isAuthenticated, profile]);

  if (!visible || thanks) {
    return thanks ? (
      <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-2xl p-4 mb-3 text-center animate-fade-in">
        <p className="text-sm font-bold text-fg">{t.susThanks}</p>
      </div>
    ) : null;
  }

  const allAnswered = ITEM_KEYS.every((k) => scores[k] !== null);

  const dismiss = () => {
    const today = jstToday();
    writeLocal(DISMISS_DAY_KEY, today);
    writeLocal(DISMISS_COUNT_KEY, String(Number(readLocal(DISMISS_COUNT_KEY) ?? '0') + 1));
    setVisible(false);
  };

  const submit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      await postJson('/api/sus', scores);
      writeLocal(SUBMITTED_KEY, '1');
      setThanks(true);
    } catch (e) {
      // 409 (already submitted elsewhere) is effectively success from the
      // user's perspective — stop asking either way.
      if (e instanceof HttpError && e.status === 409) {
        writeLocal(SUBMITTED_KEY, '1');
        setThanks(true);
      } else {
        setError(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card border border-[var(--border)] rounded-2xl p-4 mb-3 animate-fade-in">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-bold text-fg">{t.susCardTitle}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.susSkip}
          className="p-1.5 rounded-lg text-faint hover:text-fg hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <p className="text-xs text-muted mb-3 leading-relaxed">{t.susCardIntro}</p>

      <div className="space-y-4">
        {ITEM_KEYS.map((key, idx) => (
          <fieldset key={key}>
            <legend className="text-xs font-semibold text-fg mb-1.5">
              {idx + 1}. {t[ITEM_LABEL_KEYS[key]]}
            </legend>
            <div className="flex gap-1.5">
              {LIKERT_KEYS.map((likertKey, i) => {
                const value = i + 1;
                const selected = scores[key] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    title={t[likertKey]}
                    aria-label={t[likertKey]}
                    aria-pressed={selected}
                    onClick={() => setScores((s) => ({ ...s, [key]: value }))}
                    className={`flex-1 h-9 rounded-lg text-xs font-bold border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                      selected
                        ? 'bg-brand-strong text-white border-brand-strong'
                        : 'bg-surface-2 text-muted border-[var(--border)] hover:border-brand-300'
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {error && (
        <p className="text-xs text-danger mt-3">{t.susSubmitError}</p>
      )}

      <div className="flex gap-2 mt-4">
        <Button onClick={submit} disabled={!allAnswered || submitting} size="sm" className="flex-1">
          {t.susSubmit}
        </Button>
        <Button onClick={dismiss} variant="outline" size="sm">
          {t.susSkip}
        </Button>
      </div>
    </div>
  );
}
