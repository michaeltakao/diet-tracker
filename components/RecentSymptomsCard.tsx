'use client';

/**
 * Compact 「最近の症状」 dashboard widget: last 5 symptom events, neutral
 * severity display, link to /symptoms. Renders nothing when there are no
 * symptoms (record + display only — never diagnostic).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Stethoscope, ChevronRight } from 'lucide-react';
import { getAllSymptomEntries } from '@/lib/data';
import type { SymptomEntry } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';

/** Coarse relative time in Japanese-app style (falls back to the date). */
function relativeTime(iso: string, lang: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) {
    const mins = Math.max(1, Math.floor(diffMs / 60_000));
    return lang === 'ja' ? `${mins}分前` : `${mins}m ago`;
  }
  if (hours < 24) return lang === 'ja' ? `${hours}時間前` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return lang === 'ja' ? `${days}日前` : `${days}d ago`;
}

export default function RecentSymptomsCard() {
  const { t, lang } = useLanguage();
  const [recent, setRecent] = useState<SymptomEntry[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    setRecent(
      [...getAllSymptomEntries()]
        .sort((a, b) => b.onsetAt.localeCompare(a.onsetAt))
        .slice(0, 5),
    );
  }, []);

  if (recent.length === 0) return null;

  return (
    <div className="bg-card rounded-3xl shadow-card border border-line p-4 mb-3">
      <Link
        href="/symptoms"
        className="flex items-center justify-between mb-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-lg"
      >
        <span className="flex items-center gap-2">
          <Stethoscope size={14} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span className="text-xs font-black text-faint uppercase tracking-widest">{t.recentSymptoms}</span>
        </span>
        <ChevronRight size={14} className="text-faint group-hover:text-fg transition-colors" aria-hidden="true" />
      </Link>
      <ul className="space-y-1.5">
        {recent.map((e) => (
          <li key={e.id} className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 font-bold text-fg truncate">{e.name}</span>
            <span className="text-faint tabular-nums flex-shrink-0">{e.severity}/10</span>
            <span className="ml-auto text-faint flex-shrink-0">{relativeTime(e.onsetAt, lang)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
