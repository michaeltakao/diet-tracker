'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/lib/types';

interface Props {
  badges: Badge[];
  onClose: () => void;
}

const CONFETTI_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ec4899',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316',
];

interface ConfettiPiece {
  id: number;
  color: string;
  left: number;
  delay: number;
  duration: number;
  rotation: number;
  size: number;
  shape: 'rect' | 'circle';
}

export default function BadgeCelebration({ badges, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [confetti] = useState<ConfettiPiece[]>(() =>
    Array.from({ length: 55 }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left: Math.random() * 100,
      delay: Math.random() * 1.8,
      duration: 2.5 + Math.random() * 2.5,
      rotation: Math.random() * 360,
      size: 6 + Math.random() * 10,
      shape: Math.random() > 0.45 ? 'rect' : 'circle',
    }))
  );

  const advance = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (currentIndex < badges.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    timerRef.current = setTimeout(advance, 3800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, badges.length]);

  if (badges.length === 0) return null;
  const badge = badges[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(15,23,42,0.55)' }}
      onClick={advance}
    >
      {/* Glassmorphism backdrop layer */}
      <div className="absolute inset-0 backdrop-blur-sm" />

      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map((c) => (
          <div
            key={c.id}
            className="absolute animate-confetti-fall"
            style={{
              left: `${c.left}%`,
              top: '-28px',
              width: c.size,
              height: c.shape === 'circle' ? c.size : c.size * 0.5,
              backgroundColor: c.color,
              borderRadius: c.shape === 'circle' ? '50%' : '3px',
              transform: `rotate(${c.rotation}deg)`,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Badge card — glassmorphism */}
      <div
        className="
          relative z-10 mx-6 max-w-xs w-full
          bg-white/85 dark:bg-slate-800/85
          backdrop-blur-md
          border border-white/60 dark:border-slate-600/60
          rounded-3xl
          shadow-[0_24px_64px_rgb(0,0,0,0.20)]
          p-8 text-center
          animate-badge-pop
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step dots */}
        {badges.length > 1 && (
          <div className="flex justify-center gap-1.5 mb-5">
            {badges.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === currentIndex
                    ? 'w-5 h-2 bg-green-500'
                    : 'w-2 h-2 bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
        )}

        {/* Icon */}
        <div className="text-7xl mb-4 animate-bounce select-none">{badge.icon}</div>

        {/* Label pill */}
        <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-yellow-400 text-white text-xs font-black px-4 py-1.5 rounded-full mb-3 uppercase tracking-widest shadow-sm">
          🏅 バッジ獲得！
        </div>

        <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
          {badge.name}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          {badge.description}
        </p>

        <button
          onClick={(e) => { e.stopPropagation(); advance(); }}
          className="
            w-full py-3.5
            bg-gradient-to-r from-green-500 to-emerald-500
            hover:from-green-600 hover:to-emerald-600
            active:scale-[0.97]
            text-white font-bold rounded-2xl
            transition-all duration-200
            shadow-[0_4px_14px_rgba(34,197,94,0.4)]
            text-sm
          "
        >
          {currentIndex < badges.length - 1 ? `次のバッジを見る →` : `やった！🎉`}
        </button>
      </div>
    </div>
  );
}
