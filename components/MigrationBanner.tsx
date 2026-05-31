'use client';

/**
 * MigrationBanner — non-intrusive notification overlay for migration state.
 *
 * Renders as a fixed floating pill at the top-center of the screen.
 * Does not block app usage.
 * Auto-dismisses on success (after 5 s, handled by caller).
 *
 * States:
 *   idle / skipped → renders nothing
 *   checking       → spinner + "確認中..."
 *   migrating      → spinner + "データを移行中..."
 *   success        → check  + "移行が完了しました (N件)"
 *   error          → warning + "移行に失敗しました" + dismiss button
 */

import type { MigrationStatus, MigrationSummary } from '@/lib/migrate';

interface Props {
  status:   MigrationStatus;
  summary?: MigrationSummary;
  onDismiss?: () => void;
}

export default function MigrationBanner({ status, summary, onDismiss }: Props) {
  if (status === 'idle' || status === 'skipped') return null;

  const totalRecords = summary
    ? summary.foodLogs + summary.workoutLogs + summary.weightLogs +
      summary.waterLogs + summary.badges
    : 0;

  const config: Record<
    Exclude<MigrationStatus, 'idle' | 'skipped'>,
    { icon: string; text: string; bg: string; border: string; textColor: string }
  > = {
    checking: {
      icon:      '⏳',
      text:      '移行状況を確認中...',
      bg:        'bg-blue-50 dark:bg-blue-900/30',
      border:    'border-blue-200 dark:border-blue-700',
      textColor: 'text-blue-700 dark:text-blue-300',
    },
    migrating: {
      icon:      '🔄',
      text:      'データを移行中...',
      bg:        'bg-indigo-50 dark:bg-indigo-900/30',
      border:    'border-indigo-200 dark:border-indigo-700',
      textColor: 'text-indigo-700 dark:text-indigo-300',
    },
    success: {
      icon:      '✅',
      text:      totalRecords > 0
        ? `移行が完了しました（${totalRecords.toLocaleString()}件）`
        : '移行が完了しました',
      bg:        'bg-emerald-50 dark:bg-emerald-900/30',
      border:    'border-emerald-200 dark:border-emerald-700',
      textColor: 'text-emerald-700 dark:text-emerald-300',
    },
    error: {
      icon:      '⚠️',
      text:      '移行に失敗しました。ローカルデータは引き続き利用可能です。',
      bg:        'bg-amber-50 dark:bg-amber-900/30',
      border:    'border-amber-200 dark:border-amber-700',
      textColor: 'text-amber-700 dark:text-amber-300',
    },
  };

  const cfg = config[status as Exclude<MigrationStatus, 'idle' | 'skipped'>];

  const isSpinning = status === 'checking' || status === 'migrating';

  return (
    <div
      role="status"
      aria-live="polite"
      className="
        fixed top-4 left-1/2 -translate-x-1/2 z-50
        w-[calc(100%-2rem)] max-w-sm
        pointer-events-none
      "
    >
      <div
        className={`
          ${cfg.bg} ${cfg.border} ${cfg.textColor}
          border rounded-2xl
          px-4 py-3
          shadow-elevated
          flex items-center gap-3
          pointer-events-auto
        `}
      >
        {/* Icon */}
        <span
          className={`text-lg flex-shrink-0 ${isSpinning ? 'animate-spin' : ''}`}
          aria-hidden="true"
        >
          {cfg.icon}
        </span>

        {/* Message */}
        <span className="text-xs font-semibold flex-1 leading-tight">
          {cfg.text}
        </span>

        {/* Dismiss — only on error */}
        {status === 'error' && onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="閉じる"
            className="
              flex-shrink-0 w-6 h-6 rounded-full
              flex items-center justify-center
              text-amber-500 dark:text-amber-400
              hover:bg-amber-100 dark:hover:bg-amber-800/40
              transition-colors duration-150
            "
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
