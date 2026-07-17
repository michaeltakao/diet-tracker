'use client';

import { useEffect, useRef, useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** 'danger' styles the confirm button destructively. */
  variant?: 'default' | 'danger';
  /** Render a text input; its value is passed to onConfirm (prompt() replacement). */
  input?: { label?: string; placeholder?: string; defaultValue?: string };
  /** Disable confirm until the input matches this exact string (typed confirmation). */
  requireText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * Accessible replacement for native confirm()/prompt(): role=alertdialog,
 * focus trapped while open, Escape cancels, focus restored on close.
 * The body unmounts when closed so input state resets on every open.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  if (!props.open) return null;
  return <ConfirmDialogBody {...props} />;
}

function ConfirmDialogBody({
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  input,
  requireText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(input?.defaultValue ?? '');

  // Move focus into the dialog on open; restore it on close (WCAG 2.4.3).
  useEffect(() => {
    const restoreTo = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>('input, button');
    first?.focus();
    return () => restoreTo?.focus();
  }, []);

  const hasInput = input != null || requireText != null;
  const confirmDisabled =
    requireText != null ? value !== requireText : hasInput && value.trim() === '';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    // Focus trap: cycle within the dialog's focusable elements.
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      'input, button, [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 animate-fade-in"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? 'confirm-dialog-desc' : undefined}
        className="w-full max-w-sm bg-card rounded-2xl shadow-elevated border border-line p-5 animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 id="confirm-dialog-title" className="text-base font-black text-fg mb-1.5">
          {title}
        </h2>
        {description && (
          <p id="confirm-dialog-desc" className="text-xs text-muted leading-relaxed mb-3 whitespace-pre-line">
            {description}
          </p>
        )}
        {hasInput && (
          <div className="mb-3">
            {input?.label && (
              <label htmlFor="confirm-dialog-input" className="block text-xs font-bold text-faint mb-1">
                {input.label}
              </label>
            )}
            <input
              id="confirm-dialog-input"
              type="text"
              value={value}
              placeholder={input?.placeholder ?? requireText}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !confirmDisabled) onConfirm(value);
              }}
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-line-strong bg-surface-2 text-fg placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-2xl text-sm font-bold bg-surface-2 text-muted hover:bg-line transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(value)}
            disabled={confirmDisabled}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
              variant === 'danger'
                ? 'bg-danger hover:opacity-90'
                : 'bg-brand-strong hover:opacity-90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
