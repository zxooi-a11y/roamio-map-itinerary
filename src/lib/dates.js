// All trip dates are stored as local "YYYY-MM-DD" strings, which sort correctly as text.

const DAY_MS = 86400000;

/** Date -> "YYYY-MM-DD" in local time. */
export const ymd = (d) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** "YYYY-MM-DD" -> Date at local midnight. */
export const parseYmd = (s) => new Date(s + 'T00:00:00');

export const todayStr = () => ymd(new Date());

/** Add n days to a date string (or to today when dateStr is empty). */
export function addDays(dateStr, n) {
  const d = dateStr ? parseYmd(dateStr) : new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Whole days from a to b (b - a). Rounded so DST shifts don't matter. */
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / DAY_MS);

export const daysUntil = (d, today = todayStr()) => daysBetween(today, d);

/** "Monday, March 4" */
export function fmtLong(d) {
  if (!d) return '';
  const dt = parseYmd(d);
  return isNaN(dt) ? '' : dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** "4 Mar" or "4 Mar 2026" */
export const fmtShort = (d, withYear) =>
  parseYmd(d).toLocaleDateString(undefined, withYear
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short' });

/** "4 Mar – 9 Mar 2026", "28 Dec 2026 – 3 Jan 2027", or a single day. */
export const fmtRange = (a, b) =>
  a === b ? fmtShort(a, true) : fmtShort(a, a.slice(0, 4) !== b.slice(0, 4)) + ' – ' + fmtShort(b, true);

/** "1 day", "3 stops" */
export const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
