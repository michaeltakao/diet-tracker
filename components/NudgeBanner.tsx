'use client';

/**
 * Dashboard nudge banner (FTUE P0 #7): the in-app rendering of
 * lib/notifications.ts decisions. Max one per JST day; dismissal persists
 * the day to localStorage so reloads stay quiet until tomorrow.
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getAppData, getStreak } from '@/lib/data';
import { activityDaysFrom, jstToday } from '@/lib/streak';
import { decideNudge, jstHour, type NudgeDecision } from '@/lib/notifications';
import { maybeSendSelfPush } from '@/lib/push-client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/Button';

const DISMISS_KEY = 'diet-tracker-nudge-dismissed';

export default function NudgeBanner() {
  const { t, lang } = useLanguage();
  const [decision, setDecision] = useState<NudgeDecision>({ kind: 'none' });

  useEffect(() => {
    const data = getAppData();
    let lastDismissedDay: string | null = null;
    try {
      lastDismissedDay = localStorage.getItem(DISMISS_KEY);
    } catch {
      // storage unavailable → treat as never dismissed
    }
    const d = decideNudge({
      activityDays: activityDaysFrom(data),
      streak: { current: getStreak() },
      today: jstToday(),
      hour: jstHour(),
      lastDismissedDay,
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only localStorage read on mount
    setDecision(d);
    // Mirror the nudge as an OS notification for opted-in users (fire-and-
    // forget; all guards + max-1/day dedupe live in maybeSendSelfPush/server).
    if (d.kind !== 'none') void maybeSendSelfPush(d.kind, lang);
  }, [lang]);

  if (decision.kind === 'none') return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, jstToday());
    } catch {
      // storage unavailable → dismissal only lasts this render
    }
    setDecision({ kind: 'none' });
  };

  const { template } = decision;

  return (
    <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-2xl p-4 mb-3 flex items-start gap-3 animate-fade-in">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-fg">{t[template.titleKey]}</p>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">{t[template.bodyKey]}</p>
        <Button href={template.href} size="sm" className="mt-2.5">
          {t[template.ctaKey]}
        </Button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.nudgeDismiss}
        className="p-1.5 rounded-lg text-faint hover:text-fg hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
