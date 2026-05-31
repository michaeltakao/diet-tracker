'use client';

import { useEffect, useState } from 'react';
import { Timer, Play, Pause, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const PRESETS = [60, 90, 120, 180] as const;

/** Short completion beep via the Web Audio API. No-op if unsupported. */
function beep(): void {
  try {
    const w = window as unknown as { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.12;
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => void ctx.close();
  } catch {
    /* audio not available — silent */
  }
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Rest-interval timer for between sets (筋トレMEMO-style).
 * Local state only — no persistence, no data-model impact.
 */
export default function RestTimer() {
  const { lang } = useLanguage();
  const [duration, setDuration] = useState<number>(90);
  const [remaining, setRemaining] = useState<number>(90);
  const [running, setRunning] = useState<boolean>(false);

  const tr = (ja: string, en: string) => (lang === 'en' ? en : ja);

  // Tick once per second while running.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Fire completion feedback exactly when the countdown reaches zero.
  useEffect(() => {
    if (running && remaining === 0) {
      setRunning(false);
      if (typeof navigator !== 'undefined') navigator.vibrate?.([200, 100, 200]);
      beep();
    }
  }, [running, remaining]);

  const selectPreset = (sec: number) => {
    setDuration(sec);
    setRemaining(sec);
    setRunning(false);
  };

  const toggle = () => {
    if (remaining === 0) setRemaining(duration);
    setRunning((v) => !v);
  };

  const reset = () => {
    setRunning(false);
    setRemaining(duration);
  };

  const done = remaining === 0;
  const pct = duration > 0 ? (remaining / duration) * 100 : 0;

  return (
    <section
      role="group"
      aria-label={tr('インターバルタイマー', 'Rest timer')}
      className="bg-card rounded-3xl p-4 shadow-card border border-line space-y-3"
    >
      <h2 className="font-black text-fg flex items-center gap-1.5">
        <Timer className="w-5 h-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        {tr('インターバルタイマー', 'Rest Timer')}
      </h2>

      {/* Presets */}
      <div className="flex gap-1.5">
        {PRESETS.map((sec) => (
          <button
            key={sec}
            type="button"
            onClick={() => selectPreset(sec)}
            aria-pressed={duration === sec}
            className={`
              flex-1 py-1.5 rounded-full text-xs font-bold
              transition-all duration-200 active:scale-95
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
              ${duration === sec
                ? 'bg-brand-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]'
                : 'bg-surface-2 text-muted hover:bg-line'}
            `}
          >
            {sec}s
          </button>
        ))}
      </div>

      {/* Countdown display */}
      <div className="flex items-center gap-4">
        <div
          className={`text-4xl font-black tabular-nums tracking-tight ${done ? 'text-brand-600 dark:text-brand-400' : 'text-fg'}`}
          aria-live="off"
        >
          {fmt(remaining)}
        </div>
        <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden" aria-hidden="true">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500 transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={toggle}
          className="
            flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black text-white
            bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700
            shadow-[0_4px_12px_rgba(16,185,129,0.35)] active:scale-[0.98] transition-all duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
          "
          aria-label={running ? tr('一時停止', 'Pause') : tr('開始', 'Start')}
        >
          {running ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {running ? tr('一時停止', 'Pause') : tr('開始', 'Start')}
        </button>
        <button
          type="button"
          onClick={reset}
          className="
            px-4 py-3 rounded-2xl text-sm font-bold
            bg-surface-2 text-muted hover:bg-line active:scale-95 transition-all duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
          "
          aria-label={tr('リセット', 'Reset')}
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Completion announcement for assistive tech */}
      <p role="status" aria-live="assertive" className="sr-only">
        {done ? tr('休憩終了', 'Rest complete') : ''}
      </p>
    </section>
  );
}
