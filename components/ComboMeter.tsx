'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { COMBO_SLOW_MS } from '@/lib/workout-sets';

export interface ComboMeterProps {
  /** Timestamp (Date.now()) of the last combo-eligible action, or null if idle. */
  lastSetAt: number | null;
  /** Current combo streak count (≥2 once a bonus has landed). */
  comboCount: number;
}

/**
 * Self-contained combo pill: owns its own 1s tick so the parent form doesn't
 * re-render every second just to show a countdown. Renders null when idle
 * or once the combo window (COMBO_SLOW_MS) has expired.
 */
export default function ComboMeter({ lastSetAt, comboCount }: ComboMeterProps) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (lastSetAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lastSetAt]);

  if (lastSetAt === null) return null;

  const elapsed = now - lastSetAt;
  const remainingMs = COMBO_SLOW_MS - elapsed;
  if (remainingMs <= 0) return null;

  const secondsLeft = Math.ceil(remainingMs / 1000);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 px-2.5 py-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 tabular-nums">
      {comboCount >= 2 && <span>🔥 x{comboCount}</span>}
      <span>{t.comboCountdown.replace('{n}', String(secondsLeft))}</span>
    </span>
  );
}
