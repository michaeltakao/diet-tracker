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
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      duration: 2.5 + Math.random() * 2,
      rotation: Math.random() * 360,
      size: 7 + Math.random() * 9,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }))
  );

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (currentIndex < badges.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        onClose();
      }
    }, 3500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [currentIndex, badges.length, onClose]);

  if (badges.length === 0) return null;
  const badge = badges[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Confetti layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map((c) => (
          <div
            key={c.id}
            className="absolute animate-confetti-fall"
            style={{
              left: `${c.left}%`,
              top: '-24px',
              width: c.shape === 'circle' ? c.size : c.size,
              height: c.shape === 'circle' ? c.size : c.size * 0.55,
              backgroundColor: c.color,
              borderRadius: c.shape === 'circle' ? '50%' : '2px',
              transform: `rotate(${c.rotation}deg)`,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Badge card */}
      <div
        className="relative bg-white rounded-3xl shadow-2xl p-8 mx-6 text-center animate-badge-pop max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Badge count indicator */}
        {badges.length > 1 && (
          <div className="flex justify-center gap-1.5 mb-4">
            {badges.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? 'bg-green-500' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        )}

        <div className="text-7xl mb-4 animate-bounce">{badge.icon}</div>

        <div className="inline-block bg-yellow-100 text-yellow-700 text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
          バッジ獲得！
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">{badge.name}</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">{badge.description}</p>

        <button
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (currentIndex < badges.length - 1) {
              setCurrentIndex((i) => i + 1);
            } else {
              onClose();
            }
          }}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl transition-colors text-sm"
        >
          {currentIndex < badges.length - 1 ? `次のバッジを見る →` : `やった！🎉`}
        </button>
      </div>
    </div>
  );
}
