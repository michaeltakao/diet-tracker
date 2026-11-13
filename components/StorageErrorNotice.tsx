'use client';

import { useEffect, useState } from 'react';
import { Toast } from '@/components/ui/Toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { STORAGE_ERROR_EVENT } from '@/lib/storage';

const SHOW_MS = 5000;

/**
 * App-wide notice for failed localStorage writes (ADR-008 P0-2). Any
 * `safeSetItem` failure fires {@link STORAGE_ERROR_EVENT}; this shows a
 * toast so a record that was not saved is never lost silently.
 */
export function StorageErrorNotice() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onError = () => {
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), SHOW_MS);
    };
    window.addEventListener(STORAGE_ERROR_EVENT, onError);
    return () => {
      window.removeEventListener(STORAGE_ERROR_EVENT, onError);
      clearTimeout(timer);
    };
  }, []);

  return (
    <Toast
      message={visible ? t.storageSaveFailed : null}
      variant="neutral"
      className="!whitespace-normal max-w-[90vw] text-center"
    />
  );
}
