'use client';

import { Droplets } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface WaterTrackerProps {
  current: number; // ml
  goal: number;    // ml
  onAdd: (ml: number) => void;
}

const GLASS_ML = 200;

export default function WaterTracker({ current, goal, onAdd }: WaterTrackerProps) {
  const { t } = useLanguage();
  const glasses = Math.floor(goal / GLASS_ML);
  const filledGlasses = Math.min(Math.floor(current / GLASS_ML), glasses);
  const pct = Math.min((current / goal) * 100, 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Droplets size={16} className="text-blue-500" />
          <span className="text-sm font-semibold text-gray-700">{t.waterIntake}</span>
        </div>
        <span className="text-xs text-gray-500">
          {current} / {goal} ml
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
        <div
          className="bg-blue-400 h-2 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Glass icons */}
      <div className="flex gap-1.5 flex-wrap mb-3">
        {Array.from({ length: glasses }).map((_, i) => (
          <button
            key={i}
            onClick={() => {
              // Toggle: if clicking on a filled glass, subtract; if empty, add
              const targetMl = (i + 1) * GLASS_ML;
              if (current >= targetMl) {
                onAdd(-(current - (i * GLASS_ML)));
              } else {
                onAdd(targetMl - current);
              }
            }}
            className={`text-lg transition-transform active:scale-90 ${
              i < filledGlasses ? 'opacity-100' : 'opacity-25'
            }`}
            title={`${(i + 1) * GLASS_ML}ml`}
          >
            💧
          </button>
        ))}
      </div>

      {/* Quick add buttons */}
      <div className="flex gap-2">
        {[200, 350, 500].map((ml) => (
          <button
            key={ml}
            onClick={() => onAdd(ml)}
            className="flex-1 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            +{ml}ml
          </button>
        ))}
      </div>
    </div>
  );
}
