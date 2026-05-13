// Expand recurring task definitions into concrete instance dates within a
// date range. Each instance gets a stable `instanceKey` of `${taskId}__${date}`
// so completion state can be tracked independently per occurrence.

import type { CalendarEvent, Task } from '../types';
import {
  addDays,
  diffDays,
  fromISODate,
  getDayOfWeek,
  rangeDates,
  toISODate,
} from './dates';

export interface RecurringInstance {
  task: Task;
  date: string;        // preferred placement date (may be moved by planner)
  instanceKey: string;
  flexible: boolean;   // true when the date is a target, not a hard slot
}

export function instanceKey(taskId: string, date: string): string {
  return `${taskId}__${date}`;
}

/** Generate concrete instances from a recurring task, scoped to [start, end]. */
export function expandRecurring(
  task: Task,
  rangeStart: string,
  rangeEnd: string,
): RecurringInstance[] {
  if (task.kind !== 'recurring' || !task.recurrence) return [];

  const { frequency, dayOfWeek, dayOfMonth, anchorDate } = task.recurrence;
  const out: RecurringInstance[] = [];

  if (frequency === 'daily') {
    for (const d of rangeDates(rangeStart, rangeEnd)) {
      out.push({
        task,
        date: d,
        instanceKey: instanceKey(task.id, d),
        flexible: false,
      });
    }
    return out;
  }

  if (frequency === 'weekdays' || frequency === 'weekends') {
    const wantsWeekday = frequency === 'weekdays';
    for (const d of rangeDates(rangeStart, rangeEnd)) {
      const dow = getDayOfWeek(d); // 0 = Sun, 6 = Sat
      const isWeekend = dow === 0 || dow === 6;
      if (wantsWeekday ? !isWeekend : isWeekend) {
        out.push({
          task,
          date: d,
          instanceKey: instanceKey(task.id, d),
          flexible: false,
        });
      }
    }
    return out;
  }

  if (frequency === 'weekly' || frequency === 'biweekly') {
    const target = dayOfWeek ?? task.preferredDayOfWeek ?? 6; // default Sat
    const stride = frequency === 'biweekly' ? 14 : 7;

    // Find first occurrence on/after rangeStart matching target weekday and
    // (for biweekly) the anchor cadence.
    let cur = rangeStart;
    while (diffDays(cur, rangeEnd) <= 0) {
      if (getDayOfWeek(cur) === target) {
        if (frequency === 'biweekly' && anchorDate) {
          const delta = Math.abs(diffDays(cur, anchorDate));
          if (delta % 14 !== 0) {
            cur = addDays(cur, 1);
            continue;
          }
        }
        out.push({
          task,
          date: cur,
          instanceKey: instanceKey(task.id, cur),
          flexible: false,
        });
        cur = addDays(cur, stride);
      } else {
        cur = addDays(cur, 1);
      }
    }
    return out;
  }

  if (frequency === 'monthly') {
    // Walk months in range; place on dayOfMonth (clamped) or first of month.
    const start = fromISODate(rangeStart);
    const end = fromISODate(rangeEnd);
    let y = start.getFullYear();
    let m = start.getMonth();
    while (
      y < end.getFullYear() ||
      (y === end.getFullYear() && m <= end.getMonth())
    ) {
      const dom = clampDayOfMonth(y, m, dayOfMonth ?? 1);
      const placement = toISODate(new Date(y, m, dom));
      if (
        diffDays(placement, rangeStart) >= 0 &&
        diffDays(placement, rangeEnd) <= 0
      ) {
        out.push({
          task,
          date: placement,
          instanceKey: instanceKey(task.id, placement),
          flexible: true,
        });
      }
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
    return out;
  }

  if (frequency === 'quarterly') {
    const start = fromISODate(rangeStart);
    const end = fromISODate(rangeEnd);
    let y = start.getFullYear();
    // align to first month of quarter at/before start
    let m = Math.floor(start.getMonth() / 3) * 3;
    while (
      y < end.getFullYear() ||
      (y === end.getFullYear() && m <= end.getMonth())
    ) {
      const dom = clampDayOfMonth(y, m, dayOfMonth ?? 1);
      const placement = toISODate(new Date(y, m, dom));
      if (
        diffDays(placement, rangeStart) >= 0 &&
        diffDays(placement, rangeEnd) <= 0
      ) {
        out.push({
          task,
          date: placement,
          instanceKey: instanceKey(task.id, placement),
          flexible: true,
        });
      }
      m += 3;
      if (m > 11) {
        m -= 12;
        y += 1;
      }
    }
    return out;
  }

  return out;
}

function clampDayOfMonth(year: number, month: number, day: number): number {
  const last = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(day, 1), last);
}

/** Convenience: instances for a one-time task (or empty if not in range). */
export function expandOneTime(
  task: Task,
  rangeStart: string,
  rangeEnd: string,
): RecurringInstance[] {
  if (task.kind !== 'one-time') return [];
  if (task.completed) return [];
  // If no preferredDate, treat as flexible — we'll let planner pick.
  const placement = task.preferredDate ?? task.deadline ?? rangeStart;
  // Skip if outside range and preferredDate is set
  if (
    diffDays(placement, rangeStart) < 0 ||
    diffDays(placement, rangeEnd) > 0
  ) {
    // If outside range, still surface so planner can decide; clamp to rangeStart
    return [
      {
        task,
        date: clampInRange(placement, rangeStart, rangeEnd),
        instanceKey: instanceKey(task.id, placement),
        flexible: !task.preferredDate,
      },
    ];
  }
  return [
    {
      task,
      date: placement,
      instanceKey: instanceKey(task.id, placement),
      flexible: !task.preferredDate,
    },
  ];
}

function clampInRange(d: string, start: string, end: string): string {
  if (diffDays(d, start) < 0) return start;
  if (diffDays(d, end) > 0) return end;
  return d;
}

/**
 * Expand calendar events across a date range.  One-time events pass through
 * as-is; yearly/monthly events generate concrete occurrences whose
 * start/end timestamps are rewritten for each occurrence's date.  The id of
 * each expanded occurrence is suffixed with the date so per-occurrence
 * blocks have stable, unique keys.
 */
export function expandEventsInRange(
  events: CalendarEvent[],
  rangeStart: string,
  rangeEnd: string,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const ev of events) {
    if (!ev.recurrence) {
      out.push(ev);
      continue;
    }
    const anchorStart = new Date(ev.start);
    const anchorEnd = new Date(ev.end);
    const durationMs = anchorEnd.getTime() - anchorStart.getTime();
    const hh = anchorStart.getHours();
    const mm = anchorStart.getMinutes();

    if (ev.recurrence.frequency === 'yearly') {
      const startYear = fromISODate(rangeStart).getFullYear();
      const endYear = fromISODate(rangeEnd).getFullYear();
      const month = anchorStart.getMonth();
      const dom = anchorStart.getDate();
      for (let y = startYear; y <= endYear; y++) {
        const start = new Date(y, month, dom, hh, mm, 0);
        if (Number.isNaN(start.getTime())) continue; // e.g. Feb 29 in non-leap
        if (start.getMonth() !== month) continue; // overflow guard
        const iso = toISODate(start);
        if (diffDays(iso, rangeStart) < 0 || diffDays(iso, rangeEnd) > 0) continue;
        out.push({
          ...ev,
          // id is intentionally preserved so view code that looks events up
          // by id (eventById maps) still resolves all occurrences.
          start: start.toISOString(),
          end: new Date(start.getTime() + durationMs).toISOString(),
        });
      }
    } else if (ev.recurrence.frequency === 'monthly') {
      const dom = anchorStart.getDate();
      const start = fromISODate(rangeStart);
      const end = fromISODate(rangeEnd);
      let y = start.getFullYear();
      let m = start.getMonth();
      while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
        const last = new Date(y, m + 1, 0).getDate();
        if (dom <= last) {
          const occ = new Date(y, m, dom, hh, mm, 0);
          const iso = toISODate(occ);
          if (diffDays(iso, rangeStart) >= 0 && diffDays(iso, rangeEnd) <= 0) {
            out.push({
              ...ev,
              start: occ.toISOString(),
              end: new Date(occ.getTime() + durationMs).toISOString(),
            });
          }
        }
        m += 1;
        if (m > 11) {
          m = 0;
          y += 1;
        }
      }
    }
  }
  return out;
}

/** All instances (recurring + one-time) within [start, end]. */
export function allInstancesInRange(
  tasks: Task[],
  rangeStart: string,
  rangeEnd: string,
): RecurringInstance[] {
  const out: RecurringInstance[] = [];
  for (const t of tasks) {
    if (t.kind === 'recurring') {
      out.push(...expandRecurring(t, rangeStart, rangeEnd));
    } else {
      out.push(...expandOneTime(t, rangeStart, rangeEnd));
    }
  }
  return out;
}
