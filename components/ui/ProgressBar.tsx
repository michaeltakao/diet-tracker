/**
 * Standard progress bar (design phase 4): semantic-token track + flat brand
 * fill, optional gamified text overlay (Duolingo XP-bar style).
 *
 * A11y: the real value is always exposed via role="progressbar" +
 * aria-valuenow/min/max; the white overlay label is decorative (aria-hidden)
 * so its contrast against the unfilled track is not load-bearing.
 * All non-brand fills are decorative — never place text on them.
 */

export type ProgressBarVariant = 'brand' | 'warning' | 'fox' | 'info' | 'danger';

const FILL_CLASS: Record<ProgressBarVariant, string> = {
  brand: 'bg-brand-500',
  warning: 'bg-fox', // near-goal calorie state shares the fox orange
  fox: 'bg-fox',
  info: 'bg-info',
  danger: 'bg-danger',
};

export interface ProgressBarProps {
  value: number;
  max: number;
  variant?: ProgressBarVariant;
  /** Centered overlay text (e.g. "3/5日"). Also becomes the accessible name. */
  label?: string;
  /** Accessible name when no visible label is rendered. */
  ariaLabel?: string;
  className?: string;
}

export function ProgressBar({
  value,
  max,
  variant = 'brand',
  label,
  ariaLabel,
  className,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0;

  return (
    <div
      className={`relative w-full bg-surface-2 rounded-full overflow-hidden ${
        label ? 'h-6' : 'h-3'
      }${className ? ` ${className}` : ''}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label ?? ariaLabel}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ease-out ${FILL_CLASS[variant]}`}
        style={{ width: `${pct}%` }}
      />
      {label && (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.4)]"
        >
          {label}
        </span>
      )}
    </div>
  );
}
