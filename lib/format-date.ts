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

/**
 * Format a Date as a local-time `YYYY-MM-DD` string.
 *
 * Uses the local getFullYear/getMonth/getDate accessors rather than
 * `toISOString()`, which serialises in UTC and therefore returns the
 * *previous* calendar day for any local time before the UTC offset
 * (e.g. 00:00–09:00 JST). Use this for every date *key* that is compared
 * against, or stored in, an entry's `date` field so generation stays
 * consistent across the app.
 */
export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today's local-time `YYYY-MM-DD`. Safe for both SSR and client. */
export function todayLocal(): string {
  return toLocalDateStr(new Date());
}
