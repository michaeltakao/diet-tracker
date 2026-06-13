'use client';

import { WeightEntry } from '@/lib/types';
import { WEIGHT_CHART } from '@/lib/chart-theme';

interface WeightChartProps {
  entries: WeightEntry[];
  goalWeight?: number;
}

export default function WeightChart({ entries, goalWeight }: WeightChartProps) {
  if (entries.length === 0) return null;

  const weights = entries.map((e) => e.weight);
  const minW = Math.min(...weights, ...(goalWeight != null ? [goalWeight] : [])) - 1.5;
  const maxW = Math.max(...weights, ...(goalWeight != null ? [goalWeight] : [])) + 1.5;
  const range = maxW - minW || 1;

  const W   = 300;
  const H   = 130;
  const PAD = 12;

  const toX = (i: number) => PAD + (i / Math.max(entries.length - 1, 1)) * (W - PAD * 2);
  const toY = (w: number) => PAD + (1 - (w - minW) / range) * (H - PAD * 2 - 14);

  const pathD = entries
    .map((e, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(e.weight).toFixed(1)}`)
    .join(' ');

  const latest = entries.at(-1);
  const first  = entries[0];
  const diff   = latest && first ? +(latest.weight - first.weight).toFixed(1) : 0;

  const isImproving = diff <= 0; // weight loss = improving for most users

  return (
    <div>
      {/* Mini stats row */}
      <div className="flex items-center justify-between mb-3">
        {latest && (
          <div>
            <span className="text-3xl font-black text-fg tabular-nums tracking-tight">
              {latest.weight}
            </span>
            <span className="text-base text-faint font-medium ml-1">kg</span>
          </div>
        )}
        {entries.length > 1 && (
          <span className={`
            text-sm font-bold px-3 py-1 rounded-full tabular-nums
            ${diff < 0
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
              : diff > 0
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : 'bg-surface-2 text-faint'}
          `}>
            {diff > 0 ? '▲' : diff < 0 ? '▼' : '─'} {Math.abs(diff)} kg
          </span>
        )}
      </div>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 130 }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="wGradFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={WEIGHT_CHART.line} stopOpacity="0.25" />
            <stop offset="100%" stopColor={WEIGHT_CHART.line} stopOpacity="0" />
          </linearGradient>
          {/* Clipping so area fill doesn't exceed chart bounds */}
          <clipPath id="chartClip">
            <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} />
          </clipPath>
        </defs>

        {/* Goal dashed line */}
        {goalWeight != null && goalWeight >= minW && goalWeight <= maxW && (
          <line
            x1={PAD} y1={toY(goalWeight).toFixed(1)}
            x2={W - PAD} y2={toY(goalWeight).toFixed(1)}
            stroke={WEIGHT_CHART.goalLine}
            strokeWidth="1.5"
            strokeDasharray="5 3"
            opacity="0.8"
          />
        )}

        {/* Area fill */}
        {entries.length > 1 && (
          <path
            d={`${pathD} L ${toX(entries.length - 1).toFixed(1)} ${(H - PAD).toFixed(1)} L ${toX(0).toFixed(1)} ${(H - PAD).toFixed(1)} Z`}
            fill="url(#wGradFill)"
            clipPath="url(#chartClip)"
          />
        )}

        {/* Line */}
        {entries.length > 1 && (
          <path
            d={pathD}
            fill="none"
            stroke={WEIGHT_CHART.line}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Dots */}
        {entries.map((e, i) => (
          <g key={e.id}>
            <circle cx={toX(i).toFixed(1)} cy={toY(e.weight).toFixed(1)} r="5" fill="white" />
            <circle cx={toX(i).toFixed(1)} cy={toY(e.weight).toFixed(1)} r="3" fill={WEIGHT_CHART.line} />
          </g>
        ))}

        {/* Date labels: first + last */}
        {entries.length > 1 && (
          <>
            <text x={PAD} y={H - 1} fontSize="9" fill={WEIGHT_CHART.axisLabel}>{entries[0].date.slice(5)}</text>
            <text x={W - PAD} y={H - 1} fontSize="9" fill={WEIGHT_CHART.axisLabel} textAnchor="end">
              {entries.at(-1)!.date.slice(5)}
            </text>
          </>
        )}

        {/* Single point label */}
        {entries.length === 1 && (
          <text
            x={toX(0).toFixed(1)}
            y={(toY(entries[0].weight) - 8).toFixed(1)}
            fontSize="10"
            fill={WEIGHT_CHART.line}
            textAnchor="middle"
            fontWeight="bold"
          >
            {entries[0].weight} kg
          </text>
        )}
      </svg>

      {/* Trend note */}
      {entries.length > 2 && (
        <p className={`text-[11px] font-semibold text-right mt-1 ${isImproving ? 'text-success' : 'text-danger'}`}>
          {isImproving ? '📉 順調に減量中' : '📈 体重が増加傾向'}
        </p>
      )}
    </div>
  );
}
