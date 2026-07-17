'use client';

/**
 * Chip row for the onboarding wizard (D4: every question is chips).
 * Single-select; selected chip uses the brand gradient like the
 * settings-page toggles it mirrors.
 */

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  icon?:  string;
}

export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label:    string;
  options:  ReadonlyArray<ChipOption<T>>;
  value:    T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`
            px-4 py-3 rounded-2xl text-sm font-bold
            flex items-center gap-1.5
            transition-all duration-200 hover:scale-[1.02] active:scale-95
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
            ${value === opt.value
              ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-[0_4px_12px_rgba(88,204,2,0.35)]'
              : 'bg-surface-2 text-muted hover:bg-line'}
          `}
        >
          {opt.icon && <span aria-hidden>{opt.icon}</span>}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
