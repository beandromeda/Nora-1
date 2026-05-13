// Tiny set of date helpers that work in local time using ISO date strings
// (YYYY-MM-DD). We avoid timezone surprises by never round-tripping through
// UTC for date-only values.

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Event timestamps are stored as UTC ISO strings (the form uses
// `Date.toISOString()`), so reading the calendar position from raw string
// slices gives the UTC hour/day rather than what the user typed. These
// helpers convert back to the local components for display + grid placement.
export function localDateFromISO(iso: string): string {
  return toISODate(new Date(iso));
}

export function localTimeFromISO(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function diffDays(a: string, b: string): number {
  const ms = fromISODate(a).getTime() - fromISODate(b).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function startOfWeek(iso: string, weekStartsOn: 0 | 1 = 0): string {
  const d = fromISODate(iso);
  const dow = d.getDay(); // 0..6, Sun..Sat
  const offset = (dow - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - offset);
  return toISODate(d);
}

export function startOfMonth(iso: string): string {
  const d = fromISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(iso: string): string {
  const d = fromISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function startOfQuarter(iso: string): string {
  const d = fromISODate(iso);
  const qStartMonth = Math.floor(d.getMonth() / 3) * 3;
  return toISODate(new Date(d.getFullYear(), qStartMonth, 1));
}

export function rangeDates(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (diffDays(cur, end) <= 0) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatLongDate(iso: string): string {
  const d = fromISODate(iso);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function formatShortDate(iso: string): string {
  const d = fromISODate(iso);
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function formatMonthYear(iso: string): string {
  const d = fromISODate(iso);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function isSameDay(a: string, b: string): boolean {
  return a === b;
}

export function getDayOfWeek(iso: string): number {
  return fromISODate(iso).getDay();
}

export function getDayOfMonth(iso: string): number {
  return fromISODate(iso).getDate();
}

export function getMonthIndex(iso: string): number {
  return fromISODate(iso).getMonth();
}

export function quarterIndex(iso: string): number {
  return Math.floor(getMonthIndex(iso) / 3);
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatHoursDecimal(minutes: number): string {
  const hours = minutes / 60;
  // 1 decimal, but trim trailing .0
  return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
}

// Build a Monday-or-Sunday-anchored 6x7 grid of dates that covers the month
// containing `iso` (for monthly view).
export function buildMonthGrid(iso: string, weekStartsOn: 0 | 1 = 0): string[] {
  const first = startOfMonth(iso);
  const gridStart = startOfWeek(first, weekStartsOn);
  const out: string[] = [];
  for (let i = 0; i < 42; i++) out.push(addDays(gridStart, i));
  return out;
}
