'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, CheckCircle2, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { postJson } from '@/lib/httpClient';
import { CARD_CLASS as CARD } from '@/components/ui/Card';
import { useProfile } from '@/contexts/ProfileContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ConsentPage() {
  const router = useRouter();
  const { signOut } = useProfile();
  const { t } = useLanguage();
  const [agreed, setAgreed] = useState(false);
  // Starts collapsed; force-expands once on first interaction with the
  // consent checkbox (see onFocus/onClick below), then stays user-controlled.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsAutoOpened, setDetailsAutoOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [done,      setDone]      = useState(false);

  // 研究参加に同意しない場合も、アプリ本体はゲストモード（この端末のみ保存）で
  // 全機能利用できる。サインアウト + ゲストcookie（login pageと同じ）で / へ。
  const continueAsGuest = async () => {
    try {
      await signOut();
    } finally {
      // Even if sign-out fails (e.g. network), the guest exit must not strand
      // the user on the consent page.
      document.cookie = 'dt-guest=1; path=/; max-age=31536000; samesite=lax';
      router.replace('/');
    }
  };

  const expandDetailsOnce = () => {
    if (!detailsAutoOpened) {
      setDetailsAutoOpened(true);
      setDetailsOpen(true);
    }
  };

  const handleConsent = async () => {
    if (!agreed) return;
    setSubmitting(true);
    setError(null);
    try {
      await postJson('/api/consent', {});
      setDone(true);
      setTimeout(() => router.replace('/'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.consentError);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 size={48} className="text-brand-500" />
          <p className="text-sm font-bold text-fg">{t.consentDoneTitle}</p>
          <p className="text-xs text-faint">{t.consentDoneSub}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-lg space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <ClipboardList size={24} className="text-violet-500" />
          <div>
            <h1 className="text-base font-black text-fg">{t.consentTitle}</h1>
            <p className="text-xs text-faint">{t.consentLabAttribution}</p>
          </div>
        </div>

        {/* Short summary */}
        <div className={`${CARD} p-4`}>
          <ul className="list-disc list-inside space-y-1 text-xs text-muted leading-relaxed">
            <li>{t.consentBulletPurpose}</li>
            <li>{t.consentBulletAnonymized}</li>
            <li>{t.consentBulletWithdraw}</li>
          </ul>
        </div>

        {/* Detail toggle */}
        <div className={`${CARD} overflow-hidden`}>
          <button
            type="button"
            onClick={() => setDetailsOpen(v => !v)}
            aria-expanded={detailsOpen}
            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] transition-colors"
          >
            {detailsOpen
              ? <ChevronDown size={14} className="text-faint" aria-hidden="true" />
              : <ChevronRight size={14} className="text-faint" aria-hidden="true" />
            }
            <span className="text-xs font-black text-faint uppercase tracking-widest">
              {t.consentDetailsToggle}
            </span>
          </button>

          {detailsOpen && (
            <div className="px-4 pb-4 space-y-3 text-xs text-muted leading-relaxed">
              <section>
                <h2 className="font-bold text-fg mb-1">{t.consentDetailPurposeTitle}</h2>
                <p>{t.consentDetailPurposeBody}</p>
              </section>

              <section>
                <h2 className="font-bold text-fg mb-1">{t.consentDetailDataTitle}</h2>
                <ul className="list-disc list-inside space-y-0.5">
                  {t.consentDetailDataList.split('|').map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="font-bold text-fg mb-1">{t.consentDetailHandlingTitle}</h2>
                <ul className="list-disc list-inside space-y-0.5">
                  {t.consentDetailHandlingList.split('|').map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="font-bold text-fg mb-1">{t.consentDetailThirdPartyTitle}</h2>
                <p>{t.consentDetailThirdPartyBody}</p>
              </section>

              <section>
                <h2 className="font-bold text-fg mb-1">{t.consentDetailVoluntaryTitle}</h2>
                <p>{t.consentDetailVoluntaryBody}</p>
              </section>

              <section>
                <h2 className="font-bold text-fg mb-1">{t.consentDetailContactTitle}</h2>
                <p>
                  {t.consentDetailContactBody}<br />
                  {t.consentDetailContactAdvisor}
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Privacy badge — RLS-protection claim only; does NOT claim "no
            third-party sharing" since meal photos are sent to Gemini
            (disclosed above) — that claim previously contradicted the
            third-party section. */}
        <div className="flex items-center gap-2 text-xs text-faint">
          <Shield size={12} className="text-brand-500 flex-shrink-0" />
          <span>{t.consentPrivacyBadge}</span>
        </div>

        {/* ゲストモードで続ける — reachable independent of toggle state, not
            nested where it could go unseen. */}
        <button
          type="button"
          onClick={continueAsGuest}
          className="text-xs font-bold text-violet-500 dark:text-violet-400 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {t.consentGuestCta}
        </button>

        {/* Agreement checkbox */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            onFocus={expandDetailsOnce}
            onClick={expandDetailsOnce}
            className="mt-0.5 w-4 h-4 accent-violet-600 flex-shrink-0"
          />
          <span className="text-xs text-muted leading-relaxed">
            {t.consentCheckboxLabel}
          </span>
        </label>

        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.replace('/')}
            className="flex-1 py-3 rounded-2xl text-xs font-bold text-faint bg-surface-2 hover:bg-card transition-colors"
          >
            {t.consentDeferCta}
          </button>
          <button
            type="button"
            onClick={handleConsent}
            disabled={!agreed || submitting}
            className={`
              flex-1 py-3 rounded-2xl text-xs font-bold transition-all
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
              ${agreed && !submitting
                ? 'bg-violet-600 text-white hover:bg-violet-700 active:scale-95'
                : 'bg-surface-2 text-faint cursor-not-allowed'}
            `}
          >
            {submitting ? t.consentSubmitting : t.consentSubmitCta}
          </button>
        </div>

      </div>
    </div>
  );
}
