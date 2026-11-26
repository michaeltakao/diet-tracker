'use client';

/**
 * Route-level error boundary (UX P0 slice 1, UX_AUDIT #4). Rendered inside
 * the root layout, so the language context and nav are available. Data is
 * client-side (localStorage + outbox), so a render error never loses it —
 * the copy says so, because "an error happened" alone reads as data loss.
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error('[route-error]', error.digest ?? '', error.message);
  }, [error]);

  return (
    <main className="max-w-md mx-auto px-6 pt-24 pb-28 text-center">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-surface-2" aria-hidden="true">
        <AlertTriangle className="text-warning" size={28} />
      </div>
      <h1 className="text-xl font-black text-fg mb-2">{t.errorTitle}</h1>
      <p className="text-sm text-muted leading-relaxed mb-6">{t.errorBody}</p>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-xl bg-brand-strong text-white font-black px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {t.errorRetry}
        </button>
        <Link
          href="/dashboard"
          className="min-h-11 inline-flex items-center justify-center rounded-xl bg-surface-2 text-muted font-bold px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {t.errorHome}
        </Link>
      </div>
    </main>
  );
}
