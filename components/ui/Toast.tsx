'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastVariant = 'neutral' | 'success' | 'celebrate';

const VARIANT_CLASS: Record<ToastVariant, string> = {
  neutral:   'bg-fg text-surface',
  success:   'bg-brand-strong text-white',
  celebrate: 'bg-yellow-400 text-yellow-900',
};

export interface ToastAction {
  label: string;
  onClick: () => void;
}

/**
 * Transient status toast. The live region stays mounted (sr-only when empty)
 * so screen readers reliably announce content changes. With `action` it
 * carries one button (e.g. Undo, UX P0 slice 3), sized to a 44 px target.
 */
export function Toast({
  message,
  variant = 'success',
  className = '',
  action,
}: {
  message: string | null;
  variant?: ToastVariant;
  className?: string;
  action?: ToastAction | null;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        message
          ? `fixed top-12 mt-safe left-1/2 -translate-x-1/2 z-50 font-bold text-sm rounded-2xl shadow-lg animate-slide-in-up whitespace-nowrap max-w-[calc(100vw-2rem)] flex items-center gap-2 ${action ? 'pl-5 pr-1.5 py-1' : 'px-5 py-2.5'} ${VARIANT_CLASS[variant]} ${className}`
          : 'sr-only'
      }
    >
      <span className={action ? 'min-w-0 truncate' : undefined}>{message ?? ''}</span>
      {message && action && (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 min-h-11 px-3 rounded-xl underline underline-offset-2 font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/** How long an undoable toast stays (and the undo stays possible). */
export const UNDO_MS = 5000;

/**
 * State for one toast at a time, optionally with an action. A new `show`
 * replaces the previous toast and its timer, so a stale Undo can never fire
 * against a newer change.
 */
export function useToast() {
  const [state, setState] = useState<{ message: string; action: ToastAction | null } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setState(null);
  }, []);

  const show = useCallback((message: string, action: ToastAction | null = null, ms = action ? UNDO_MS : 2500) => {
    if (timer.current) clearTimeout(timer.current);
    setState({ message, action });
    timer.current = setTimeout(() => { timer.current = null; setState(null); }, ms);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { message: state?.message ?? null, action: state?.action ?? null, show, clear };
}
