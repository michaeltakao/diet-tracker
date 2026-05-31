'use client';

import { useEffect, useState } from 'react';
import { X, Download, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'android' | 'ios' | 'desktop' | null;

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'desktop';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

const DISMISS_KEY = 'pwa-install-dismissed';

export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow]       = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [iosHint, setIosHint]  = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const p = detectPlatform();
    setPlatform(p);

    // Chrome / Edge / Android: listen for install prompt
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS Safari: no prompt event — show manual hint after 3s
    if (p === 'ios') {
      const t = setTimeout(() => setShow(true), 3000);
      return () => {
        window.removeEventListener('beforeinstallprompt', onPrompt);
        clearTimeout(t);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  const handleInstall = async () => {
    if (platform === 'ios') {
      setIosHint(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShow(false);
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <>
      {/* Main banner */}
      <div
        role="dialog"
        aria-label="ホーム画面に追加"
        className="
          fixed bottom-20 left-4 right-4 z-40 max-w-md mx-auto
          bg-card/90
          backdrop-blur-md
          border border-line
          rounded-3xl
          shadow-elevated
          p-4
          animate-slide-in-up
          flex items-center gap-3
        "
      >
        {/* App icon */}
        <div className="
          w-12 h-12 rounded-2xl flex-shrink-0
          bg-gradient-to-br from-brand-500 to-teal-600
          flex items-center justify-center text-2xl
          shadow-[0_4px_12px_rgba(16,185,129,0.4)]
        " aria-hidden="true">
          🥗
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-fg">
            ホーム画面に追加
          </p>
          <p className="text-xs text-faint mt-0.5">
            {platform === 'ios'
              ? 'Safari の共有メニューから追加できます'
              : 'オフラインでも使えるアプリ版'}
          </p>
        </div>

        {/* Install button */}
        <button
          onClick={handleInstall}
          className="
            flex items-center gap-1.5 px-3.5 py-2
            bg-gradient-to-r from-brand-500 to-brand-600
            text-white text-xs font-black rounded-xl flex-shrink-0
            shadow-[0_4px_12px_rgba(16,185,129,0.4)]
            hover:scale-[1.03] active:scale-95
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
            transition-all duration-200
          "
        >
          {platform === 'ios' ? <Share size={13} aria-hidden="true" /> : <Download size={13} aria-hidden="true" />}
          {platform === 'ios' ? '方法' : 'インストール'}
        </button>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          aria-label="閉じる"
          className="p-2 rounded-lg text-faint hover:text-fg active:scale-90 transition-all duration-200 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* iOS step-by-step hint overlay */}
      {iosHint && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ホーム画面への追加方法"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center p-4 animate-fade-in"
          onClick={() => setIosHint(false)}
        >
          <div
            className="
              bg-card
              rounded-3xl w-full max-w-md
              shadow-elevated
              p-6
              animate-badge-pop
            "
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black text-fg mb-4">
              📱 ホーム画面への追加方法
            </h2>
            <ol className="space-y-3">
              {[
                { icon: '1', text: 'Safari の下部にある「共有」ボタン（□↑）をタップ' },
                { icon: '2', text: '「ホーム画面に追加」を選択' },
                { icon: '3', text: '右上の「追加」をタップ' },
              ].map(({ icon, text }) => (
                <li key={icon} className="flex items-start gap-3">
                  <span className="
                    w-7 h-7 rounded-full flex-shrink-0
                    bg-brand-500 text-white
                    flex items-center justify-center
                    text-xs font-black
                  " aria-hidden="true">
                    {icon}
                  </span>
                  <p className="text-sm text-muted leading-relaxed pt-0.5">{text}</p>
                </li>
              ))}
            </ol>
            <button
              onClick={() => { setIosHint(false); dismiss(); }}
              autoFocus
              className="
                mt-5 w-full py-3 rounded-2xl font-black text-sm text-white
                bg-gradient-to-r from-brand-500 to-brand-600
                shadow-[0_4px_14px_rgba(16,185,129,0.4)]
                hover:scale-[1.01] active:scale-[0.98]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
                transition-all duration-200
              "
            >
              わかった！
            </button>
          </div>
        </div>
      )}
    </>
  );
}
