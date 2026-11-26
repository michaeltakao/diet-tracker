'use client';

/** 404 page (UX P0 slice 1). Client component so the copy follows the language setting. */
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <main className="max-w-md mx-auto px-6 pt-24 pb-28 text-center">
      <p className="text-5xl font-black text-faint mb-4 tabular-nums" aria-hidden="true">404</p>
      <h1 className="text-xl font-black text-fg mb-2">{t.notFoundTitle}</h1>
      <p className="text-sm text-muted mb-6">{t.notFoundBody}</p>
      <Link
        href="/dashboard"
        className="min-h-11 inline-flex items-center justify-center rounded-xl bg-brand-strong text-white font-black px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        {t.errorHome}
      </Link>
    </main>
  );
}
