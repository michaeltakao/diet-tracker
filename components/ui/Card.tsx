import type { HTMLAttributes } from 'react';

/**
 * The app's standard card surface. Exported both as a component and as the
 * raw class string for call sites that compose it inside template literals.
 */
export const CARD_CLASS = 'bg-card rounded-2xl shadow-card border-2 border-line';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className ? `${CARD_CLASS} ${className}` : CARD_CLASS} {...props} />;
}
