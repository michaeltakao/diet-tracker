'use client';

/**
 * Shared minimal tooltip for the trends charts — token-based surface so it
 * adapts to dark mode (recharts' default tooltip is hardcoded white).
 */
export function ChartTooltip({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; color?: string }>;
}) {
  return (
    <div className="bg-card border border-line-strong shadow-elevated rounded-xl px-3 py-2 text-xs">
      <p className="font-bold text-fg mb-1">{title}</p>
      {rows.map(r => (
        <p key={r.label} className="flex items-center gap-1.5 text-muted">
          {r.color && (
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: r.color }}
              aria-hidden
            />
          )}
          <span>{r.label}</span>
          <span className="ml-auto pl-3 font-bold tabular-nums text-fg">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

/** MM/DD tick label from a YYYY-MM-DD date string. */
export function shortDate(date: string): string {
  return date.slice(5).replace('-', '/');
}
