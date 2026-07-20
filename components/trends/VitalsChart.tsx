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
export interface WellnessPoint { date: string; sleepQuality?: number; stressLevel?: number; sleepHours?: number }

export interface VitalsChartLabels {
  systolic: string;
  diastolic: string;
  glucose: string;
  sleepQuality: string;
  stress: string;
  sleepHours?: string;
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

export interface LipidPoint {
  date: string;
  totalMgDl: number;
  ldlMgDl?: number;
  hdlMgDl?: number;
  triglyceridesMgDl?: number;
}

export interface LipidChartLabels {
  total: string;
  ldl: string;
  hdl: string;
  tg: string;
}

const LIPID_SERIES = [
  { key: 'totalMgDl' as const, labelKey: 'total' as const, color: 'var(--fg)' },
  { key: 'ldlMgDl' as const, labelKey: 'ldl' as const, color: 'var(--warning)' },
  { key: 'hdlMgDl' as const, labelKey: 'hdl' as const, color: 'var(--info)' },
  { key: 'triglyceridesMgDl' as const, labelKey: 'tg' as const, color: 'var(--muted)' },
];

/** Lipid panel: total always present; LDL/HDL/TG lines connect across gaps. */
export function LipidChart({ points, labels }: { points: LipidPoint[]; labels: LipidChartLabels }) {
  const data = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps}
          axisLine={{ stroke: 'var(--line-strong)' }} interval="preserveStartEnd" minTickGap={40} />
        <YAxis {...axisProps} axisLine={false} width={40} />
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as LipidPoint;
            const rows = LIPID_SERIES
              .filter((s) => p[s.key] != null)
              .map((s) => ({ label: labels[s.labelKey], value: `${p[s.key]} mg/dL`, color: s.color }));
            return <ChartTooltip title={String(label)} rows={rows} />;
          }}
        />
        {LIPID_SERIES.map((s) => (
          <Line key={s.key} dataKey={s.key} stroke={s.color} strokeWidth={2}
            isAnimationActive={false} dot={{ r: 2.5 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export interface Hba1cPoint { date: string; hba1cPercent: number }

export function Hba1cChart({ points, label }: { points: Hba1cPoint[]; label: string }) {
  const data = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps}
          axisLine={{ stroke: 'var(--line-strong)' }} interval="preserveStartEnd" minTickGap={40} />
        <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} {...axisProps} axisLine={false} width={32} />
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)' }}
          content={({ active, payload, label: xLabel }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as Hba1cPoint;
            return (
              <ChartTooltip title={String(xLabel)}
                rows={[{ label, value: `${p.hba1cPercent}%`, color: 'var(--ai)' }]} />
            );
          }}
        />
        <Line dataKey="hba1cPercent" stroke="var(--ai)" strokeWidth={2} isAnimationActive={false} dot={{ r: 2.5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WellnessChart({ points, labels }: { points: WellnessPoint[]; labels: VitalsChartLabels }) {
  const data = [...points].sort((a, b) => a.date.localeCompare(b.date));
  // sleepHours (0–14h) doesn't share the 1–5 quality/stress scale — a second
  // Y-axis (right) keeps both readable without distorting either.
  const hasHours = data.some((p) => p.sleepHours != null);
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 8, right: hasHours ? 20 : 8, bottom: 0, left: -10 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps}
          axisLine={{ stroke: 'var(--line-strong)' }} interval="preserveStartEnd" minTickGap={40} />
        <YAxis yAxisId="quality" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...axisProps} axisLine={false} width={24} />
        {hasHours && (
          <YAxis yAxisId="hours" orientation="right" domain={[0, 14]} {...axisProps} axisLine={false} width={28} />
        )}
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as WellnessPoint;
            const rows = [];
            if (p.sleepQuality != null) rows.push({ label: labels.sleepQuality, value: `${p.sleepQuality}/5`, color: 'var(--info)' });
            if (p.stressLevel != null) rows.push({ label: labels.stress, value: `${p.stressLevel}/5`, color: 'var(--warning)' });
            if (p.sleepHours != null && labels.sleepHours) rows.push({ label: labels.sleepHours, value: `${p.sleepHours}h`, color: 'var(--fox)' });
            return <ChartTooltip title={String(label)} rows={rows} />;
          }}
        />
        <Line yAxisId="quality" dataKey="sleepQuality" stroke="var(--info)" strokeWidth={2} isAnimationActive={false} dot={{ r: 2.5 }} connectNulls />
        <Line yAxisId="quality" dataKey="stressLevel" stroke="var(--warning)" strokeWidth={2} isAnimationActive={false} dot={{ r: 2.5 }} connectNulls />
        {hasHours && (
          <Line yAxisId="hours" dataKey="sleepHours" stroke="var(--fox)" strokeWidth={2} strokeDasharray="4 3" isAnimationActive={false} dot={{ r: 2.5 }} connectNulls />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
