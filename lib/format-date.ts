/**
 * Deterministic date formatters for Japanese/English.
 * Avoids toLocaleDateString() which produces different output on
 * Node.js (SSR) vs browser (client), causing React hydration mismatches.
 */

const DOW_SHORT_JA = ['日', '月', '火', '水', '木', '金', '土'] as const;
const DOW_LONG_JA  = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'] as const;
const DOW_LONG_EN  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MON_LONG_EN  = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'] as const;

/** "5月29日(金)" */
export function fmtMonthDayDowShortJa(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日(${DOW_SHORT_JA[d.getDay()]})`;
}

/** "5月29日 金曜日" */
export function fmtMonthDayDowLongJa(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${DOW_LONG_JA[d.getDay()]}`;
}

/** "5/29(金)" */
export function fmtShortJa(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}(${DOW_SHORT_JA[d.getDay()]})`;
}

/** weekday short + date num, for calendar cells */
export function fmtCalendarCell(dateStr: string): { day: string; num: string } {
  const d = new Date(dateStr + 'T00:00:00');
  return { day: DOW_SHORT_JA[d.getDay()], num: String(d.getDate()) };
}

/** "Friday, May 29" */
export function fmtLongEn(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DOW_LONG_EN[d.getDay()]}, ${MON_LONG_EN[d.getMonth()]} ${d.getDate()}`;
}

// ── JST clock (ADR-008 P0-1) ────────────────────────────────────────────────
// Every stored `date` is a JST calendar day, matching the SQL side's
// Asia/Tokyo day (lib/api-guard.ts). `toISOString().split('T')[0]` is the UTC
// day and lags JST by one between 00:00 and 08:59 — do not use it for dates.

/** Asia/Tokyo offset from UTC; Japan has no DST. */
const JST_OFFSET_MS = 9 * 3_600_000;

/** JST calendar day (YYYY-MM-DD) of an instant; defaults to now. */
export function toJstDate(at: Date | number = Date.now()): string {
  return new Date(+at + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today's JST calendar day (YYYY-MM-DD). */
export function todayJst(): string {
  return toJstDate();
}

/** JST wall-clock time (HH:MM) of an instant; defaults to now. */
export function nowJstTime(at: Date | number = Date.now()): string {
  return new Date(+at + JST_OFFSET_MS).toISOString().slice(11, 16);
}

/** ISO-8601 UTC instant for a JST calendar day + HH:MM wall-clock time. */
export function jstTimestamp(date: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const jstMidnight = Date.parse(`${date}T00:00:00Z`) - JST_OFFSET_MS;
  return new Date(jstMidnight + (h * 60 + m) * 60_000).toISOString();
}

/** Today's YYYY-MM-DD (JST), safe for both SSR and client */
export function todayStr(): string {
  return todayJst();
}
