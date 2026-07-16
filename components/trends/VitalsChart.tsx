'use client';

/**
 * Vitals trends: BP two-line chart, glucose scatter-by-context, and 1–5
 * sleep-quality / stress series from check-ins. RECORD ONLY — neutral series
 * colors, no threshold bands, no zone shading, no verdicts.
 */

import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartTooltip, shortDate } from './ChartTooltip';

export interface BpPoint { date: string; systolic: number; diastolic: number }
export interface GlucosePoint { date: string; glucoseMgDl: number; context: string }
export interface WellnessPoint { date: string; sleepQuality?: number; stressLevel?: number }

export interface VitalsChartLabels {
  systolic: string;
  diastolic: string;
  glucose: string;
  sleepQuality: string;
  stress: string;
  contextLabels: Record<string, string>;
}

const CONTEXT_COLORS: Record<string, string> = {
  fasting:      'var(--ai)',
  postprandial: 'var(--warning)',
  random:       'var(--faint)',
};

const axisProps = {
  tick: { fill: 'var(--faint)', fontSize: 10 },
  tickLine: false,
} as const;

export function BpChart({ points, labels }: { points: BpPoint[]; labels: VitalsChartLabels }) {
  const data = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps}
          axisLine={{ stroke: 'var(--line-strong)' }} interval="preserveStartEnd" minTickGap={40} />
        <YAxis domain={['dataMin - 10', 'dataMax + 10']} {...axisProps} axisLine={false} width={40} />
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as BpPoint;
            return (
              <ChartTooltip
                title={String(label)}
                rows={[
                  { label: labels.systolic, value: `${p.systolic} mmHg`, color: 'var(--fg)' },
                  { label: labels.diastolic, value: `${p.diastolic} mmHg`, color: 'var(--muted)' },
                ]}
              />
            );
          }}
        />
        <Line dataKey="systolic" stroke="var(--fg)" strokeWidth={2} isAnimationActive={false} dot={{ r: 2.5 }} />
        <Line dataKey="diastolic" stroke="var(--muted)" strokeWidth={2} isAnimationActive={false} dot={{ r: 2.5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GlucoseChart({ points, labels }: { points: GlucosePoint[]; labels: VitalsChartLabels }) {
  const data = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="date" type="category" allowDuplicatedCategory={false}
          tickFormatter={shortDate} {...axisProps}
          axisLine={{ stroke: 'var(--line-strong)' }} interval="preserveStartEnd" minTickGap={40} />
        <YAxis dataKey="glucoseMgDl" domain={['dataMin - 20', 'dataMax + 20']} {...axisProps} axisLine={false} width={40} />
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as GlucosePoint;
            return (
              <ChartTooltip
                title={shortDate(p.date)}
                rows={[
                  {
                    label: labels.contextLabels[p.context] ?? p.context,
                    value: `${p.glucoseMgDl} mg/dL`,
                    color: CONTEXT_COLORS[p.context] ?? 'var(--faint)',
                  },
                ]}
              />
            );
          }}
        />
        {Object.keys(CONTEXT_COLORS).map((ctx) => (
          <Scatter
            key={ctx}
            name={labels.contextLabels[ctx] ?? ctx}
            data={data.filter((p) => p.context === ctx)}
            fill={CONTEXT_COLORS[ctx]}
            isAnimationActive={false}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function WellnessChart({ points, labels }: { points: WellnessPoint[]; labels: VitalsChartLabels }) {
  const data = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps}
          axisLine={{ stroke: 'var(--line-strong)' }} interval="preserveStartEnd" minTickGap={40} />
        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...axisProps} axisLine={false} width={24} />
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as WellnessPoint;
            const rows = [];
            if (p.sleepQuality != null) rows.push({ label: labels.sleepQuality, value: `${p.sleepQuality}/5`, color: 'var(--info)' });
            if (p.stressLevel != null) rows.push({ label: labels.stress, value: `${p.stressLevel}/5`, color: 'var(--warning)' });
            return <ChartTooltip title={String(label)} rows={rows} />;
          }}
        />
        <Line dataKey="sleepQuality" stroke="var(--info)" strokeWidth={2} isAnimationActive={false} dot={{ r: 2.5 }} connectNulls />
        <Line dataKey="stressLevel" stroke="var(--warning)" strokeWidth={2} isAnimationActive={false} dot={{ r: 2.5 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
