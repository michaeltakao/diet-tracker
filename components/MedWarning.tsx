'use client';

import { useState } from 'react';
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  warnings: string[];
  title?: string;
  /** 'food' for nutrition warnings, 'workout' for exercise warnings */
  type?: 'food' | 'workout';
  /** Collapse after N warnings (default 2) */
  collapseAfter?: number;
}

export default function MedWarning({
  warnings,
  title,
  type = 'food',
  collapseAfter = 2,
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded,  setExpanded]  = useState(false);

  if (!warnings.length || dismissed) return null;

  const visible = expanded ? warnings : warnings.slice(0, collapseAfter);
  const hasMore = warnings.length > collapseAfter;

  const color = type === 'workout'
    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300'
    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300';

  const iconColor = type === 'workout' ? 'text-orange-500' : 'text-amber-500';

  const defaultTitle = type === 'workout'
    ? '持病・服薬に関する運動注意事項'
    : '持病・服薬に関する食事注意事項';

  return (
    <div className={`rounded-2xl border p-3.5 mb-3 ${color}`}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={15} className={`shrink-0 mt-0.5 ${iconColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-wide mb-2 opacity-80">
            {title ?? defaultTitle}
          </p>
          <ul className="space-y-1.5">
            {visible.map((w, i) => (
              <li key={i} className="text-xs font-medium leading-relaxed">
                {w}
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-xs font-bold mt-2 opacity-70 hover:opacity-100 transition-opacity"
            >
              {expanded ? (
                <><ChevronUp size={12} /> 折りたたむ</>
              ) : (
                <><ChevronDown size={12} /> あと{warnings.length - collapseAfter}件表示</>
              )}
            </button>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
          aria-label="閉じる"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
