'use client';

import { Badge } from '@/lib/types';

interface BadgeShelfProps {
  badges: Badge[];
  maxVisible?: number;
  title?: string;
  className?: string;
}

export default function BadgeShelf({ badges, maxVisible = 30, title, className = '' }: BadgeShelfProps) {
  if (badges.length === 0) return null;

  const sorted = [...badges]
    .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
    .slice(0, maxVisible);

  return (
    <div className={className}>
      {title && (
        <h2 className="text-sm font-semibold text-muted mb-2.5">{title}</h2>
      )}
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
        {sorted.map((b) => (
          <div
            key={b.id}
            title={b.description}
            className="
              flex-shrink-0 flex items-center gap-1.5
              bg-yellow-50 dark:bg-yellow-900/20
              border border-yellow-200 dark:border-yellow-800
              rounded-full px-3 py-1.5
              hover:scale-[1.04] active:scale-[0.96]
              transition-all duration-200
              cursor-default select-none
            "
          >
            <span className="text-sm leading-none">{b.icon}</span>
            <span className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 whitespace-nowrap">
              {b.name.replace(/^[^\s]+\s/, '')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
