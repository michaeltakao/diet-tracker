'use client';

export type ToastVariant = 'neutral' | 'success' | 'celebrate';

const VARIANT_CLASS: Record<ToastVariant, string> = {
  neutral:   'bg-fg text-surface',
  success:   'bg-brand-strong text-white',
  celebrate: 'bg-yellow-400 text-yellow-900',
};

/**
 * Transient status toast. The live region stays mounted (sr-only when empty)
 * so screen readers reliably announce content changes.
 */
export function Toast({
  message,
  variant = 'success',
  className = '',
}: {
  message: string | null;
  variant?: ToastVariant;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        message
          ? `fixed top-12 left-1/2 -translate-x-1/2 z-50 font-bold text-sm px-5 py-2.5 rounded-2xl shadow-lg animate-slide-in-up whitespace-nowrap ${VARIANT_CLASS[variant]} ${className}`
          : 'sr-only'
      }
    >
      {message ?? ''}
    </div>
  );
}
