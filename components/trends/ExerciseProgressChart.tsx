'use client';

/**
 * Per-exercise progression chart (phase C, spec C3): top weight + estimated
 * 1RM lines over time, with an exercise picker fed from weighted history.
 * Series math lives in lib/workout-analytics.ts.
 */

import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { exerciseProgressSeries, weightedExerciseNames } from '@/lib/workout-analytics';
import type { WorkoutEntry } from '@/lib/types';
import { ChartTooltip, shortDate } from './ChartTooltip';

export interface ExerciseProgressChartProps {
  entries: WorkoutEntry[];
  labels: {
    selectExercise: string;
    topWeight: string;
    est1RM: string;
  };
}

export function ExerciseProgressChart({ entries, labels }: ExerciseProgressChartProps) {
  const names = useMemo(() => weightedExerciseNames(entries), [entries]);
  const [selected, setSelected] = useState<string | null>(null);
  const exercise = selected ?? names[0] ?? null;

  const series = useMemo(
    () => (exercise ? exerciseProgressSeries(entries, exercise) : []),
    [entries, exercise],
  );

  if (!exercise) return null;

  return (
    <div>
      <select
        value={exercise}
        onChange={(e) => setSelected(e.target.value)}
        aria-label={labels.selectExercise}
        className="mb-2 w-full px-3 py-2 rounded-xl border border-line-strong bg-surface-2 text-xs font-bold text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        {names.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: 'var(--faint)', fontSize: 10 }}
            tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} interval="preserveStartEnd" minTickGap={40} />
          <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fill: 'var(--faint)', fontSize: 10 }}
            tickLine={false} axisLine={false} width={40} />
          <Tooltip
            cursor={{ stroke: 'var(--line-strong)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { topWeight: number; est1RM: number };
              return (
                <ChartTooltip
                  title={shortDate(String(label))}
                  rows={[
                    { label: labels.topWeight, value: `${p.topWeight} kg`, color: 'var(--fg)' },
                    { label: labels.est1RM, value: `${p.est1RM} kg`, color: 'var(--brand-500)' },
                  ]}
                />
              );
            }}
          />
          <Line dataKey="topWeight" stroke="var(--fg)" strokeWidth={2} isAnimationActive={false} dot={{ r: 2.5 }} />
          <Line dataKey="est1RM" stroke="var(--brand-500)" strokeWidth={2} strokeDasharray="4 3" isAnimationActive={false} dot={{ r: 2.5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
