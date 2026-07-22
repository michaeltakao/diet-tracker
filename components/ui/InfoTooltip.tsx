'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface InfoTooltipProps {
  /** Accessible label for the trigger button, e.g. "What is XP?". */
  label: string;
  /** Popover body content. */
  children: ReactNode;
}

const POPOVER_WIDTH = 224; // px, matches w-56
const VIEWPORT_MARGIN = 8;

/**
 * Minimal click-to-toggle help popover (not hover-only — hover fails on
 * touch devices, which matters for this app's diverse-age/tech-comfort
 * target population). Escape and click-outside both close it, borrowed from
 * components/ui/ConfirmDialog.tsx's overlay wiring but scoped down: a single
 * popover body needs no focus trap (WAI-ARIA popover pattern, not a modal).
 *
 * Rendered via a portal to document.body: several call sites sit inside
 * `overflow-hidden` cards (e.g. SystemPanel), which would otherwise clip an
 * absolutely-positioned popover to near-zero height. Position is computed
 * from the trigger's viewport rect on open/scroll/resize.
 */
export function InfoTooltip({ label, children }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.min(
        Math.max(rect.left, VIEWPORT_MARGIN),
        window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN,
      );
      setCoords({ top: rect.bottom + 6, left });
    };
    updatePosition();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handlePointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="
          inline-flex items-center justify-center w-4 h-4 rounded-full
          text-[10px] font-bold leading-none
          bg-surface-2 text-faint border border-line
          hover:bg-line hover:text-fg
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
        "
      >
        ?
      </button>
      {open && coords && createPortal(
        <div
          role="tooltip"
          style={{ top: coords.top, left: coords.left, width: POPOVER_WIDTH }}
          className="
            fixed z-50
            bg-card border border-line-strong shadow-elevated rounded-xl
            px-3 py-2 text-xs text-muted
          "
        >
          {children}
        </div>,
        document.body,
      )}
    </span>
  );
}
