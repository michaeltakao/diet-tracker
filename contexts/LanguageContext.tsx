'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Lang, translations, Translations } from '@/lib/i18n';

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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ja');

  useEffect(() => {
    const stored = localStorage.getItem('diet-tracker-lang') as Lang | null;
    if (stored === 'ja' || stored === 'en') {
      setLangState(stored);
    }
  }, []);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem('diet-tracker-lang', newLang);
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
