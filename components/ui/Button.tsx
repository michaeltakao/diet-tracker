import Link from 'next/link';
import type { ButtonHTMLAttributes } from 'react';

/**
 * Duolingo-style button (design phase 4): flat fill + hard 4px bottom edge
 * (no blur), pressed = translate down 2px while the edge shrinks to 2px.
 *
 * Contrast (WCAG AA, verified): primary = white on --brand-strong #378700
 * (4.54:1); secondary = white on --info-strong #2b70c9 (4.93:1). brand-500/600
 * and macaw #1CB0F6 fail AA for white text and are reserved for hover/decor.
 */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'lg' | 'md' | 'sm';

const BASE_CLASS = `
  font-black rounded-xl inline-flex items-center justify-center gap-2
  transition-all duration-150 select-none
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
  disabled:opacity-60
`;

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: `
    bg-brand-strong text-white
    shadow-[0_4px_0_var(--brand-900)]
    hover:bg-brand-600
    active:translate-y-[2px] active:shadow-[0_2px_0_var(--brand-900)]
  `,
  secondary: `
    bg-info-strong text-white
    shadow-[0_4px_0_#1e5299]
    hover:bg-[#3579d3]
    active:translate-y-[2px] active:shadow-[0_2px_0_#1e5299]
  `,
  outline: `
    bg-card border-2 border-brand-600 text-brand-strong
    shadow-[0_4px_0_var(--color-brand-600)]
    hover:bg-brand-50 dark:hover:bg-brand-900/20
    active:translate-y-[2px] active:shadow-[0_2px_0_var(--color-brand-600)]
  `,
  ghost: `
    bg-transparent text-brand-strong
    hover:bg-brand-50 dark:hover:bg-brand-900/20
  `,
};

// Grid-true paddings (8px grid, phase 3) — no py-1.5/py-2.5 half-steps.
const SIZE_CLASS: Record<ButtonSize, string> = {
  lg: 'px-6 py-3 text-lg',
  md: 'px-4 py-2 text-base',
  sm: 'px-3 py-1 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** When set, renders a next/link <Link> styled as a button (CTA links). */
  href?: string;
}

function compose(...classes: (string | undefined)[]): string {
  return classes
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function Button({
  variant = 'primary',
  size = 'md',
  href,
  className,
  children,
  type,
  ...rest
}: ButtonProps) {
  const cls = compose(BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], className);

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  // Default to type="button" — native "submit" is a footgun outside forms.
  return (
    <button type={type ?? 'button'} className={cls} {...rest}>
      {children}
    </button>
  );
}
