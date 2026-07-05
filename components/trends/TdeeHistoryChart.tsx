'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { tdeeConfidenceLabel } from '@/lib/tdee';
import { ChartTooltip, shortDate } from './ChartTooltip';

export interface TdeePoint {
  date: string;
  tdeeKcal: number;
  rSquared: number | null;
}

interface TdeeHistoryChartProps {
  points: TdeePoint[];
  labels: { tdee: string; confidence: string };
}

/**
 * TDEE estimate history (AI accent). Confidence (R²) styles each dot via the
 * existing tdeeConfidenceLabel buckets: 高 = filled, 中 = translucent,
 * 低/— = hollow, and is spelled out in the tooltip so it is not color-alone.
 */
export function TdeeHistoryChart({ points, labels }: TdeeHistoryChartProps) {
  const data = [...points].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fill: 'var(--faint)', fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--line-strong)' }}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          domain={['dataMin - 100', 'dataMax + 100']}
          tick={{ fill: 'var(--faint)', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => String(Math.round(v))}
        />
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as TdeePoint;
            return (
              <ChartTooltip
                title={String(label)}
                rows={[
                  { label: labels.tdee, value: `${Math.round(p.tdeeKcal)} kcal`, color: 'var(--ai)' },
                  { label: labels.confidence, value: tdeeConfidenceLabel(p.rSquared) },
                ]}
              />
            );
          }}
        />
        <Line
          dataKey="tdeeKcal"
          stroke="var(--ai)"
          strokeWidth={2}
          isAnimationActive={false}
          dot={({ cx, cy, payload, index }) => {
            const conf = tdeeConfidenceLabel((payload as TdeePoint).rSquared);
            const filled = conf === '高';
            const translucent = conf === '中';
            return (
              <circle
                key={index}
                cx={cx}
                cy={cy}
                r={3.5}
                fill={filled || translucent ? 'var(--ai)' : 'var(--card)'}
                fillOpacity={translucent ? 0.45 : 1}
                stroke="var(--ai)"
                strokeWidth={1.5}
              />
            );
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
