'use client';

/**
 * Dashboard opt-in card for Web Push (FTUE P0 #7, second half).
 *
 * Shown only to authenticated users on push-capable browsers that have not
 * decided yet (Notification.permission === 'default'). Explicit opt-in — the
 * browser prompt fires only from the Enable button, never automatically.
 * Dismissal is sticky (localStorage); the Settings row is the permanent
 * re-entry point.
 */

import { useEffect, useState } from 'react';
import { X, Bell } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { isPushSupported, subscribeToPush } from '@/lib/push-client';
import { useProfile } from '@/contexts/ProfileContext';
import { useLanguage } from '@/contexts/LanguageContext';

const PROMPT_DISMISS_KEY = 'diet-tracker-push-prompt-dismissed';

type CardState = 'hidden' | 'prompt' | 'busy' | 'error';

export default function PushPermissionCard() {
  const { t } = useLanguage();
  const { isAuthenticated } = useProfile();
  const [state, setState] = useState<CardState>('hidden');

  useEffect(() => {
    if (
      !isSupabaseConfigured() ||
      !isAuthenticated ||
      !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      !isPushSupported() ||
      Notification.permission !== 'default'
    ) {
      return;
    }
    let dismissed: string | null = null;
    try {
      dismissed = localStorage.getItem(PROMPT_DISMISS_KEY);
    } catch {
      // storage unavailable → treat as never dismissed
    }
    if (dismissed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only permission/localStorage read on mount
    setState('prompt');
  }, [isAuthenticated]);

  if (state === 'hidden') return null;

  const dismiss = () => {
    try {
      localStorage.setItem(PROMPT_DISMISS_KEY, '1');
    } catch {
      // storage unavailable → dismissal only lasts this render
    }
    setState('hidden');
  };

  const enable = async () => {
    setState('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        // denied/dismissed at the browser level — the card's job is done
        setState('hidden');
        return;
      }
      const ok = await subscribeToPush();
      setState(ok ? 'hidden' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-3xl p-4 mb-3 flex items-start gap-3 animate-fade-in">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-fg flex items-center gap-1.5">
          <Bell size={14} aria-hidden="true" />
          {t.pushCardTitle}
        </p>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">{t.pushCardBody}</p>
        {state === 'error' && (
          <p className="text-xs text-red-500 mt-1">{t.pushError}</p>
        )}
        <div className="flex items-center gap-2 mt-2.5">
          <button
            type="button"
            onClick={enable}
            disabled={state === 'busy'}
            className="
              inline-flex items-center justify-center
              px-4 py-2 rounded-xl
              bg-gradient-to-br from-brand-500 to-brand-600 text-white
              text-xs font-bold shadow-card
              hover:scale-[1.03] active:scale-95 disabled:opacity-60
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
              transition-all duration-200
            "
          >
            {t.pushEnable}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-muted hover:text-fg hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {t.pushCardDismiss}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.pushCardDismiss}
        className="p-1.5 rounded-lg text-faint hover:text-fg hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
