'use client';

/**
 * Volume-by-body-part bar chart (phase C, spec C2) with a week/month range
 * toggle. Volume math lives in lib/workout-analytics.ts; this component only
 * picks the window and renders.
 */

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { volumeByBodyPart } from '@/lib/workout-analytics';
import { jstToday, shiftDate, weekStartOf } from '@/lib/streak';
import type { MusclePart, WorkoutEntry } from '@/lib/types';
import { ChartTooltip } from './ChartTooltip';

type RangeKey = 'week' | 'month';

export interface VolumeByBodyPartChartProps {
  entries: WorkoutEntry[];
  labels: {
    parts: Record<MusclePart, string>;
    week: string;
    month: string;
    volume: string;
  };
}

const PART_ORDER: readonly MusclePart[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs'];

export function VolumeByBodyPartChart({ entries, labels }: VolumeByBodyPartChartProps) {
  const [range, setRange] = useState<RangeKey>('week');
  const today = jstToday();

  const data = useMemo(() => {
    const start = range === 'week' ? weekStartOf(today) : shiftDate(today, -29);
    const totals = volumeByBodyPart(entries, start, today);
    return PART_ORDER.map((p) => ({ part: labels.parts[p], volume: totals[p] }));
  }, [entries, range, today, labels.parts]);

  return (
    <div>
      <div className="flex gap-1.5 mb-2" role="tablist" aria-label={labels.volume}>
        {([['week', labels.week], ['month', labels.month]] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={range === key}
            onClick={() => setRange(key)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
              range === key ? 'bg-surface-2 text-fg' : 'text-faint hover:text-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="part" tick={{ fill: 'var(--faint)', fontSize: 10 }} tickLine={false}
            axisLine={{ stroke: 'var(--line-strong)' }} />
          <YAxis tick={{ fill: 'var(--faint)', fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            cursor={{ fill: 'var(--line)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { part: string; volume: number };
              return (
                <ChartTooltip
                  title={p.part}
                  rows={[{ label: labels.volume, value: `${p.volume.toLocaleString()} kg`, color: 'var(--fox)' }]}
                />
              );
            }}
          />
          <Bar dataKey="volume" fill="var(--fox)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
