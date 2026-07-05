'use client';

import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { SmoothedWeightPoint } from '@/lib/trends';
import type { WeightTrend } from '@/lib/types';
import { ChartTooltip, shortDate } from './ChartTooltip';

interface WeightTrendChartProps {
  series: SmoothedWeightPoint[];
  goalWeight?: number;
  trend: WeightTrend | null;
  labels: { raw: string; trend: string; goal: string; projection: string };
}

/**
 * Raw daily weights (dots) + EWMA trend line + goal reference + dashed
 * linear projection to the goal date. Single accent (brand); identity is
 * carried by mark form (dot vs line vs dashed), not color.
 */
export function WeightTrendChart({ series, goalWeight, trend, labels }: WeightTrendChartProps) {
  // Dashed projection segment: last smoothed point → projected goal date.
  const last = series[series.length - 1];
  const projectionData =
    trend?.projectedGoalDate && goalWeight != null && last
      ? [
          { date: last.date, projected: last.smoothed },
          { date: trend.projectedGoalDate, projected: goalWeight },
        ]
      : [];

  // Merge projection points into the axis domain (category axis: union of dates).
  const data: Array<{ date: string; raw?: number; smoothed?: number; projected?: number }> = [
    ...series.map(p => ({ date: p.date, raw: p.raw, smoothed: p.smoothed })),
  ];
  if (projectionData.length === 2) {
    const lastRow = data[data.length - 1] as { projected?: number };
    lastRow.projected = projectionData[0].projected;
    data.push({ date: projectionData[1].date, projected: projectionData[1].projected });
  }

  const weights = series.flatMap(p => [p.raw, p.smoothed]);
  if (goalWeight != null) weights.push(goalWeight);
  const yMin = Math.floor(Math.min(...weights) - 1);
  const yMax = Math.ceil(Math.max(...weights) + 1);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
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
          domain={[yMin, yMax]}
          tick={{ fill: 'var(--faint)', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={46}
        />
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const rows = payload
              .filter(p => p.value != null)
              .map(p => ({
                label:
                  p.dataKey === 'raw' ? labels.raw
                  : p.dataKey === 'smoothed' ? labels.trend
                  : labels.projection,
                value: `${Number(p.value).toFixed(1)} kg`,
                color: p.dataKey === 'raw' ? 'var(--faint)' : 'var(--brand)',
              }));
            return <ChartTooltip title={String(label)} rows={rows} />;
          }}
        />
        {goalWeight != null && (
          <ReferenceLine
            y={goalWeight}
            stroke="var(--success)"
            strokeDasharray="5 3"
            label={{
              value: `${labels.goal} ${goalWeight}kg`,
              position: 'insideBottomRight',
              fill: 'var(--faint)',
              fontSize: 10,
            }}
          />
        )}
        <Scatter
          dataKey="raw"
          // shape fn: recharts spreads internal props onto cloned elements,
          // so render the dot ourselves with only valid SVG attributes
          shape={(props: unknown) => {
            const { cx, cy } = props as { cx?: number; cy?: number };
            if (cx == null || cy == null) return <g />;
            return <circle cx={cx} cy={cy} r={2.5} fill="var(--faint)" opacity={0.55} />;
          }}
        />
        <Line
          dataKey="smoothed"
          stroke="var(--brand)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="projected"
          stroke="var(--brand)"
          strokeWidth={2}
          strokeDasharray="4 4"
          strokeOpacity={0.6}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
