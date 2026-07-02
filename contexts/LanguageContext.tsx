'use client';

import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { Lang, translations, Translations } from '@/lib/i18n';

const LANG_STORAGE_KEY = 'diet-tracker-lang';

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'ja',
  setLang: () => {},
  t: translations.ja,
});

/** Subscribe to cross-tab (`storage`) and same-tab (custom event) lang changes. */
function subscribeLang(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener('diet-tracker:lang-change', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('diet-tracker:lang-change', onChange);
  };
}

/** Client snapshot — read the stored language, defaulting to Japanese. */
function getStoredLang(): Lang {
  if (typeof window === 'undefined') return 'ja';
  return localStorage.getItem(LANG_STORAGE_KEY) === 'en' ? 'en' : 'ja';
}

/** Server snapshot — localStorage is unavailable during SSR. */
const getServerLang = (): Lang => 'ja';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Backed by useSyncExternalStore: SSR/first hydration resolves to 'ja' (matching
  // the server-rendered <html lang="ja">), then re-reads the stored preference.
  const lang = useSyncExternalStore(subscribeLang, getStoredLang, getServerLang);

  // Keep <html lang> in sync with the selected language (WCAG 3.1.1).
  // The root layout renders lang="ja" on the server; this corrects it on the
  // client whenever the language changes so assistive tech announces correctly.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (newLang: Lang) => {
    localStorage.setItem(LANG_STORAGE_KEY, newLang);
    // Notify this tab's subscribers; the `storage` event covers other tabs.
    window.dispatchEvent(new Event('diet-tracker:lang-change'));
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
