'use client';

import { WeightEntry } from '@/lib/types';

interface WeightChartProps {
  entries: WeightEntry[];
  goalWeight?: number;
}

export default function WeightChart({ entries, goalWeight }: WeightChartProps) {
  if (entries.length === 0) return null;

  const weights = entries.map((e) => e.weight);
  const minW = Math.min(...weights, goalWeight ?? Infinity) - 1;
  const maxW = Math.max(...weights, goalWeight ?? -Infinity) + 1;
  const range = maxW - minW || 1;

  const W = 300;
  const H = 120;
  const PAD = 8;

  const toX = (i: number) =>
    PAD + (i / Math.max(entries.length - 1, 1)) * (W - PAD * 2);
  const toY = (w: number) =>
    PAD + (1 - (w - minW) / range) * (H - PAD * 2);

  const pathD = entries
    .map((e, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(e.weight)}`)
    .join(' ');

  const latest = entries.at(-1);
  const first = entries[0];
  const diff = latest && first ? latest.weight - first.weight : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        {latest && (
          <span className="text-2xl font-bold text-gray-900">{latest.weight} kg</span>
        )}
        {entries.length > 1 && (
          <span
            className={`text-sm font-medium px-2 py-0.5 rounded-full ${
              diff < 0
                ? 'bg-green-100 text-green-700'
                : diff > 0
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
        {/* Goal line */}
        {goalWeight && goalWeight >= minW && goalWeight <= maxW && (
          <line
            x1={PAD}
            y1={toY(goalWeight)}
            x2={W - PAD}
            y2={toY(goalWeight)}
            stroke="#86efac"
            strokeWidth="1.5"
            strokeDasharray="4,3"
          />
        )}

        {/* Area fill */}
        {entries.length > 1 && (
          <path
            d={`${pathD} L ${toX(entries.length - 1)} ${H} L ${toX(0)} ${H} Z`}
            fill="url(#weightGrad)"
            opacity="0.3"
          />
        )}

        <defs>
          <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Line */}
        {entries.length > 1 && (
          <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Dots */}
        {entries.map((e, i) => (
          <circle
            key={e.id}
            cx={toX(i)}
            cy={toY(e.weight)}
            r="3"
            fill="#6366f1"
          />
        ))}

        {/* Labels: first and last date */}
        {entries.length > 1 && (
          <>
            <text x={PAD} y={H - 1} fontSize="9" fill="#9ca3af">{entries[0].date.slice(5)}</text>
            <text x={W - PAD} y={H - 1} fontSize="9" fill="#9ca3af" textAnchor="end">{entries.at(-1)!.date.slice(5)}</text>
          </>
        )}
      </svg>
    </div>
  );
}
