'use client';

import { Lock } from 'lucide-react';
import { TITLES, type TitleKey } from '@/lib/titles';
import { useLanguage } from '@/contexts/LanguageContext';

interface TitleDisplayProps {
  earned: Set<TitleKey>;
}

export default function TitleDisplay({ earned }: TitleDisplayProps) {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-2 gap-3">
      {TITLES.map((def) => {
        const isEarned = earned.has(def.key);
        const name = isEarned ? (t[def.nameKey as keyof typeof t] as string) : t.titleLocked;
        const desc = isEarned ? (t[def.descKey as keyof typeof t] as string) : undefined;

        return (
          <div
            key={def.key}
            className={`system-panel rounded-xl p-3 text-center ${isEarned ? 'neon-glow' : 'opacity-40 grayscale'}`}
          >
            {!isEarned && (
              <div className="flex justify-center mb-1">
                <Lock size={16} className="text-[var(--sys-text-muted)]" aria-hidden="true" />
              </div>
            )}
            <p className={`text-xs font-black ${isEarned ? 'neon-text' : 'text-[var(--sys-text-muted)]'}`}>
              {name}
            </p>
            {desc && (
              <p className="mt-1 text-[10px] text-[var(--sys-text-muted)] leading-snug">
                {desc}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
