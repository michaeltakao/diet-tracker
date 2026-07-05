'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { DailyBalancePoint } from '@/lib/trends';
import { ChartTooltip, shortDate } from './ChartTooltip';

interface IntakeExpenditureChartProps {
  points: DailyBalancePoint[];
  labels: { intake: string; expenditure: string };
}

/**
 * Daily intake (bars, brand) vs TDEE expenditure (step line, neutral ink).
 * One shared kcal axis; series identity is carried by mark form (bar vs line)
 * plus the legend, not color alone.
 */
export function IntakeExpenditureChart({ points, labels }: IntakeExpenditureChartProps) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
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
          tick={{ fill: 'var(--faint)', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as DailyBalancePoint;
            const rows = [];
            if (p.intakeKcal != null)
              rows.push({ label: labels.intake, value: `${p.intakeKcal} kcal`, color: 'var(--brand)' });
            if (p.expenditureKcal != null)
              rows.push({ label: labels.expenditure, value: `${Math.round(p.expenditureKcal)} kcal`, color: 'var(--muted)' });
            if (rows.length === 0) return null;
            return <ChartTooltip title={String(label)} rows={rows} />;
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value: string) => (
            <span style={{ color: 'var(--muted)' }}>
              {value === 'intakeKcal' ? labels.intake : labels.expenditure}
            </span>
          )}
        />
        <Bar
          dataKey="intakeKcal"
          fill="var(--brand)"
          radius={[4, 4, 0, 0]}
          maxBarSize={16}
          isAnimationActive={false}
        />
        <Line
          dataKey="expenditureKcal"
          type="stepAfter"
          stroke="var(--muted)"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
