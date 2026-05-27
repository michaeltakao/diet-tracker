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
      <div className="
        fixed bottom-20 left-4 right-4 z-40 max-w-md mx-auto
        bg-white/90 dark:bg-gray-800/90
        backdrop-blur-md
        border border-gray-200 dark:border-gray-700
        rounded-3xl
        shadow-[0_16px_48px_rgb(0,0,0,0.12)] dark:shadow-[0_16px_48px_rgb(0,0,0,0.4)]
        p-4
        animate-slide-in-up
        flex items-center gap-3
      ">
        {/* App icon */}
        <div className="
          w-12 h-12 rounded-2xl flex-shrink-0
          bg-gradient-to-br from-green-500 to-teal-600
          flex items-center justify-center text-2xl
          shadow-[0_4px_12px_rgba(34,197,94,0.4)]
        ">
          🥗
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-gray-900 dark:text-white">
            ホーム画面に追加
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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
            bg-gradient-to-r from-green-500 to-emerald-600
            text-white text-xs font-black rounded-xl flex-shrink-0
            shadow-[0_4px_12px_rgba(34,197,94,0.4)]
            hover:scale-[1.03] active:scale-95
            transition-all duration-200
          "
        >
          {platform === 'ios' ? <Share size={13} /> : <Download size={13} />}
          {platform === 'ios' ? '方法' : 'インストール'}
        </button>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 active:scale-90 transition-all duration-200 flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* iOS step-by-step hint overlay */}
      {iosHint && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center p-4 animate-fade-in"
          onClick={() => setIosHint(false)}
        >
          <div
            className="
              bg-white dark:bg-gray-800
              rounded-3xl w-full max-w-md
              shadow-[0_24px_64px_rgb(0,0,0,0.25)]
              p-6
              animate-badge-pop
            "
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black text-gray-900 dark:text-white mb-4">
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
                    bg-green-500 text-white
                    flex items-center justify-center
                    text-xs font-black
                  ">
                    {icon}
                  </span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pt-0.5">{text}</p>
                </li>
              ))}
            </ol>
            <button
              onClick={() => { setIosHint(false); dismiss(); }}
              className="
                mt-5 w-full py-3 rounded-2xl font-black text-sm text-white
                bg-gradient-to-r from-green-500 to-emerald-600
                shadow-[0_4px_14px_rgba(34,197,94,0.4)]
                hover:scale-[1.01] active:scale-[0.98]
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
