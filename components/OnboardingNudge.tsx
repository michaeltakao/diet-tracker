'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import { getHealthProfile } from '@/lib/data';
import { useLanguage } from '@/contexts/LanguageContext';

const DISMISS_KEY = 'diet-tracker:onboard-dismissed';

/**
 * First-run nudge.
 *
 * When the user has not filled in their health profile yet, invite them to set
 * it up so calorie/macro goals and recommendations are personalised rather than
 * left at the generic defaults (2000 kcal, etc.). Dismissible and client-only:
 * visibility is decided in an effect (localStorage is unavailable during SSR),
 * so the server renders nothing and there is no hydration mismatch. Renders
 * nothing once dismissed or once any profile field is set.
 */
export default function OnboardingNudge() {
  const { t } = useLanguage();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {}
    if (dismissed) return;

    const p = getHealthProfile();
    const profileEmpty =
      p.age == null &&
      p.healthConditions.length === 0 &&
      p.dietaryRestrictions.length === 0 &&
      p.medications.length === 0;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only check on mount
    if (profileEmpty) setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {}
    setShow(false);
  };

  return (
    <div
      role="region"
      aria-label={t.onboardTitle}
      className="relative mb-3 rounded-3xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 p-4 pr-11"
    >
      <button
        onClick={dismiss}
        aria-label={t.onboardDismiss}
        className="
          absolute top-3 right-3 w-7 h-7 rounded-xl
          flex items-center justify-center text-faint
          hover:text-fg hover:bg-surface-2
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
          transition-colors
        "
      >
        <X size={16} aria-hidden="true" />
      </button>
      <div className="flex items-start gap-2.5">
        <Sparkles size={18} className="text-brand-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-bold text-fg">{t.onboardTitle}</h2>
          <p className="text-xs text-muted mt-1 leading-relaxed">{t.onboardBody}</p>
          <Link
            href="/settings"
            className="
              inline-flex items-center mt-3 px-3.5 py-2 rounded-2xl
              bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
              transition-colors
            "
          >
            {t.onboardCta}
          </Link>
        </div>
      </div>
    </div>
  );
}
