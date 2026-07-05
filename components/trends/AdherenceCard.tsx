'use client';

import type { AdherenceSeries, AdherenceStatus } from '@/lib/trends';
import { shortDate } from './ChartTooltip';

const STATUS_STYLE: Record<AdherenceStatus, { dot: string; symbol: string }> = {
  within: { dot: 'bg-success', symbol: '●' },
  over:   { dot: 'bg-warning', symbol: '▲' },
  under:  { dot: 'bg-info',    symbol: '▼' },
  noData: { dot: 'bg-line-strong', symbol: '—' },
};

interface AdherenceCardProps {
  series: AdherenceSeries;
  labels: {
    title: string;
    within: string;
    over: string;
    under: string;
    noData: string;
    ofLoggedDays: (n: number) => string;
  };
}

/**
 * Stat tile (not a chart): headline adherence % + one status cell per day.
 * Status is never color-alone — each cell carries a distinct symbol and an
 * accessible per-day label; the legend spells out all states.
 */
export function AdherenceCard({ series, labels }: AdherenceCardProps) {
  const legend: Array<{ status: AdherenceStatus; text: string }> = [
    { status: 'within', text: labels.within },
    { status: 'over', text: labels.over },
    { status: 'under', text: labels.under },
    { status: 'noData', text: labels.noData },
  ];

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-black text-fg tabular-nums">
          {series.adherencePct != null ? `${series.adherencePct}%` : '—'}
        </span>
        <span className="text-xs text-faint">{labels.ofLoggedDays(series.loggedDays)}</span>
      </div>

      {/* One cell per day */}
      <div className="flex gap-1 mb-3">
        {series.perDay.map(d => {
          const s = STATUS_STYLE[d.status];
          const statusText = legend.find(l => l.status === d.status)?.text ?? d.status;
          return (
            <div
              key={d.date}
              role="img"
              aria-label={`${d.date}: ${statusText}${d.kcal != null ? ` (${d.kcal} kcal)` : ''}`}
              title={`${shortDate(d.date)} — ${statusText}${d.kcal != null ? ` (${d.kcal} kcal)` : ''}`}
              className={`flex-1 h-7 rounded-lg ${s.dot} ${d.status === 'noData' ? 'opacity-40' : ''} flex items-center justify-center`}
            >
              <span className="text-[10px] font-black text-white/90" aria-hidden>
                {s.symbol}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend — states are labeled, never color-alone */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {legend.map(({ status, text }) => (
          <span key={status} className="flex items-center gap-1 text-xs text-faint">
            <span className={`inline-block w-2.5 h-2.5 rounded ${STATUS_STYLE[status].dot} ${status === 'noData' ? 'opacity-40' : ''}`} aria-hidden />
            {STATUS_STYLE[status].symbol} {text}
          </span>
        ))}
      </div>
    </div>
  );
}
