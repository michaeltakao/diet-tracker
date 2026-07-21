'use client';

/**
 * Always-on floating feedback button (FTUE roadmap §12 beta-gate feedback
 * channel, Workstream 6). Mounted globally in app/layout.tsx so it is
 * reachable from every page, authenticated or guest — submission works
 * without login (see app/api/feedback/route.ts).
 *
 * Deliberately minimal: a floating icon button that opens a single textarea
 * + submit modal. No categorization/screenshot/rating — those are explicitly
 * out of scope for this round (keep the bar to report low, per the roadmap's
 * "make it painless to leave a note" framing).
 */

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { postJson } from '@/lib/httpClient';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';

const MAX_LENGTH = 2000;

export default function FeedbackButton() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setMessage('');
    setError(false);
  };

  const submit = async () => {
    const trimmed = message.trim();
    if (trimmed.length === 0 || submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      await postJson('/api/feedback', { message: trimmed, pagePath: pathname });
      close();
      setToast(t.feedbackSent);
      setTimeout(() => setToast(null), 2500);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Toast message={toast} variant="success" />

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.feedbackOpen}
        className="
          fixed bottom-20 right-4 lg:bottom-6 z-40
          flex size-12 items-center justify-center rounded-full
          bg-fg text-surface shadow-[0_4px_16px_rgb(0,0,0,0.25)]
          hover:opacity-90 active:scale-95 transition-all
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
        "
      >
        <MessageCircle className="size-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.feedbackTitle}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in"
          style={{ background: 'rgba(15,23,42,0.55)' }}
          onClick={close}
        >
          <div
            className="relative z-10 w-full sm:max-w-sm mx-0 sm:mx-6 bg-card border border-line rounded-t-3xl sm:rounded-2xl shadow-elevated p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="text-base font-black text-fg">{t.feedbackTitle}</p>
              <button
                type="button"
                onClick={close}
                aria-label={t.feedbackClose}
                className="p-1.5 rounded-lg text-faint hover:text-fg hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
              placeholder={t.feedbackPlaceholder}
              rows={4}
              autoFocus
              className="
                w-full rounded-xl border border-[var(--border)] bg-surface-2
                p-3 text-sm text-fg placeholder:text-faint resize-none
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
              "
            />

            {error && <p className="text-xs text-danger mt-2">{t.feedbackError}</p>}

            <div className="flex justify-end mt-3">
              <Button onClick={submit} disabled={message.trim().length === 0 || submitting} size="sm">
                {t.feedbackSubmit}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
