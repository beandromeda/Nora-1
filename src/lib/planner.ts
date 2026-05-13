// Pure planning engine. Given tasks, calendar events, capacity overrides,
// manual overrides (drag-and-drop placements), and a date range, produce a
// PlanResult describing how the week/month/quarter is laid out.
//
// Algorithm summary:
//   1. Seed each day with capacity (override > default).
//   2. Place every CalendarEvent on its day as a fixed block, debiting capacity.
//   3. Expand recurring + one-time tasks into instances within the range.
//   4. Apply manual placements (drag-drop user choices) — these "pin" an
//      instance to a specific day, but still respect non-negotiable >
//      negotiable ordering and capacity-overflow behavior.
//   5. Sort remaining instances by priority (non-negotiable first), then
//      deadline proximity, then preferred-day fit.
//   6. Place each instance on its preferred day if it fits; otherwise look at
//      nearby days within the range. If the task is splittable, fill what
//      fits and carry the remainder forward.
//   7. Anything that still doesn't fit becomes UnplacedTask with a reason.

import type {
  CalendarEvent,
  CapacityOverride,
  DayPlan,
  PlanResult,
  ScheduledBlock,
  Task,
  UnplacedTask,
} from '../types';
import {
  addDays,
  diffDays,
  fromISODate,
  getDayOfWeek,
  localDateFromISO,
  localTimeFromISO,
  rangeDates,
  toISODate,
} from './dates';
import {
  allInstancesInRange,
  expandEventsInRange,
  type RecurringInstance,
} from './recurrence';

export interface PlanInput {
  tasks: Task[];
  events: CalendarEvent[];
  capacityOverrides: CapacityOverride[];
  manualPlacements: Record<string, string>; // instanceKey -> dateISO
  completedInstances: Record<string, boolean>; // instanceKey -> true
  // instanceKey -> "HH:MM" — start-time pins from the Daily time-grid.
  scheduledTimes?: Record<string, string>;
  defaultDailyCapacityMinutes: number;
  // Optional per-weekday capacity (length 7, Sun..Sat). When supplied, takes
  // precedence over defaultDailyCapacityMinutes. capacityOverrides for a
  // specific date still win over both.
  weekdayCapacityMinutes?: number[];
  // Per-task buffer minutes added to each task block when computing day load.
  bufferMinutesBetweenTasks?: number;
  rangeStart: string;
  rangeEnd: string;
}

export function planRange(input: PlanInput): PlanResult {
  const {
    tasks,
    events,
    capacityOverrides,
    manualPlacements,
    completedInstances,
    scheduledTimes,
    defaultDailyCapacityMinutes,
    weekdayCapacityMinutes,
    bufferMinutesBetweenTasks,
    rangeStart,
    rangeEnd,
  } = input;

  const buffer = Math.max(0, bufferMinutesBetweenTasks ?? 0);

  // 1) Seed days
  const dates = rangeDates(rangeStart, rangeEnd);
  const overrideMap = new Map(capacityOverrides.map((o) => [o.date, o]));
  const days: Map<string, DayPlan> = new Map(
    dates.map((d) => {
      const dow = getDayOfWeek(d);
      const weekdayDefault =
        weekdayCapacityMinutes?.[dow] ?? defaultDailyCapacityMinutes;
      return [
        d,
        {
          date: d,
          capacityMinutes: overrideMap.has(d)
            ? overrideMap.get(d)!.minutes
            : weekdayDefault,
          capacityOverridden: overrideMap.has(d),
          blocks: [],
          bufferMinutes: buffer,
        },
      ];
    }),
  );

  // 2) Place calendar events first (they're fixed).  Recurring events
  // (yearly birthdays, monthly anniversaries) get expanded into concrete
  // occurrences for the range here.
  const expandedEvents = expandEventsInRange(events, rangeStart, rangeEnd);
  for (const ev of expandedEvents) {
    // Event timestamps are UTC-encoded; convert to the user's local components
    // so the day bucket and the time-grid position match what they entered.
    const date = localDateFromISO(ev.start);
    const day = days.get(date);
    if (!day) continue;
    const minutes = Math.max(
      15,
      Math.round(
        (new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 60000,
      ),
    );
    const instanceKey = `${ev.id}__${date}`;
    day.blocks.push({
      id: `event-${ev.id}-${date}`,
      date,
      minutes,
      kind: 'event',
      eventId: ev.id,
      instanceKey,
      completed: Boolean(completedInstances[instanceKey]),
      scheduledTime: localTimeFromISO(ev.start),
    });
  }

  // 3) Expand task instances (by original/preferred date). Completed instances
  // stay in the plan so they remain visible (greyed out) — they're flagged
  // post-placement and excluded from capacity math.
  const expanded = allInstancesInRange(tasks, rangeStart, rangeEnd);

  // 4) Apply manual placements (drag-and-drop / assistant moves).
  //    Two responsibilities here:
  //      a) Drop instances whose manual destination is OUTSIDE this range —
  //         otherwise the placer falls back onto a nearby day in range,
  //         which on single-day views (Daily) is the original date again.
  //      b) Pull in instances whose ORIGINAL date is outside the range but
  //         whose manual destination lands INSIDE it — those wouldn't show
  //         up otherwise.
  const existingKeys = new Set(expanded.map((i) => i.instanceKey));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  for (const [key, destDate] of Object.entries(manualPlacements)) {
    if (existingKeys.has(key)) continue;
    if (destDate < rangeStart || destDate > rangeEnd) continue;
    const sep = key.lastIndexOf('__');
    if (sep < 0) continue;
    const taskId = key.slice(0, sep);
    const task = taskById.get(taskId);
    if (!task) continue;
    expanded.push({
      task,
      date: destDate,
      instanceKey: key,
      flexible: false,
    });
  }

  const allInstances: RecurringInstance[] = [];
  for (const inst of expanded) {
    const moved = manualPlacements[inst.instanceKey];
    if (moved !== undefined) {
      if (moved < rangeStart || moved > rangeEnd) continue;
      inst.date = moved;
    }
    allInstances.push(inst);
  }

  // 5) Sort: priority > deadline urgency > preferred-day proximity to today
  const sorted = [...allInstances].sort(taskInstanceCompare);

  const movedTasks: PlanResult['movedTasks'] = [];
  const unplaced: UnplacedTask[] = [];

  // 6) Place each instance.  We place non-completed instances first so they
  // get capacity priority, then completed ones into the leftover space — they
  // still belong on the timeline visually but they shouldn't push real work
  // off the day.
  const liveInstances = sorted.filter((i) => !completedInstances[i.instanceKey]);
  const doneInstances = sorted.filter((i) => completedInstances[i.instanceKey]);
  for (const inst of liveInstances) {
    placeInstance(
      inst,
      days,
      dates,
      manualPlacements,
      movedTasks,
      unplaced,
      buffer,
    );
  }
  for (const inst of doneInstances) {
    placeInstance(
      inst,
      days,
      dates,
      manualPlacements,
      movedTasks,
      unplaced,
      buffer,
    );
  }

  // 7) Mark completed task blocks so the UI can render them greyed without
  // changing the planner's placement logic. Also fold in any user-set hour
  // pins from the Daily time grid.
  for (const day of days.values()) {
    for (const b of day.blocks) {
      if (b.kind === 'task' && b.instanceKey) {
        if (completedInstances[b.instanceKey]) b.completed = true;
        const pinned = scheduledTimes?.[b.instanceKey];
        if (pinned) b.scheduledTime = pinned;
      }
    }
  }

  return {
    days: dates.map((d) => days.get(d)!),
    unplaced,
    movedTasks,
    rangeStart,
    rangeEnd,
  };
}

function taskInstanceCompare(a: RecurringInstance, b: RecurringInstance) {
  // Non-negotiable first
  if (a.task.priority !== b.task.priority) {
    return a.task.priority === 'non-negotiable' ? -1 : 1;
  }
  // Earlier deadlines first (no deadline = far future)
  const ad = a.task.deadline ?? '9999-12-31';
  const bd = b.task.deadline ?? '9999-12-31';
  if (ad !== bd) return ad < bd ? -1 : 1;
  // Larger duration first within same priority/deadline (pack big rocks)
  if (a.task.estimatedMinutes !== b.task.estimatedMinutes) {
    return b.task.estimatedMinutes - a.task.estimatedMinutes;
  }
  return a.task.name.localeCompare(b.task.name);
}

// Buffer-aware load: each placed task block reserves an extra `buffer`
// minutes of breathing room. Events do not consume buffer (they're real
// calendar time the user has no flexibility around). Completed blocks don't
// consume capacity — they've already happened.
function dayUsedMinutes(day: DayPlan, buffer = 0): number {
  const live = day.blocks.filter((b) => !b.completed);
  const blockMins = live.reduce((s, b) => s + b.minutes, 0);
  if (buffer <= 0) return blockMins;
  const taskCount = live.filter((b) => b.kind === 'task').length;
  return blockMins + taskCount * buffer;
}

function dayFreeMinutes(day: DayPlan, buffer = 0): number {
  return Math.max(0, day.capacityMinutes - dayUsedMinutes(day, buffer));
}

function placeInstance(
  inst: RecurringInstance,
  days: Map<string, DayPlan>,
  dates: string[],
  manualPlacements: Record<string, string>,
  movedTasks: PlanResult['movedTasks'],
  unplaced: UnplacedTask[],
  buffer: number,
) {
  const task = inst.task;
  const wantedDate = inst.date;
  let remaining = task.estimatedMinutes;
  const minBlock = task.minBlockMinutes ?? 15;

  // Build search order: preferred date first, then alternating outward.
  const searchOrder = nearestDateOrder(wantedDate, dates);

  // Non-negotiable tasks may push into "overload" if they truly don't fit
  // anywhere — but we still prefer days with capacity.
  const isManual = manualPlacements[inst.instanceKey] !== undefined;
  const allowOverloadOnPreferred =
    isManual || task.priority === 'non-negotiable';

  for (const candidate of searchOrder) {
    if (remaining <= 0) break;
    const day = days.get(candidate);
    if (!day) continue;
    // New task placements need their own buffer slot, so subtract that here.
    const free = Math.max(0, dayFreeMinutes(day, buffer) - buffer);

    // For manual placements, drop the block in even if it overloads — that's
    // the user's explicit choice. The day will visually flag overload.
    if (isManual && candidate === wantedDate) {
      const partMinutes = Math.min(remaining, Math.max(remaining, free));
      day.blocks.push(
        buildBlock(inst, candidate, partMinutes, undefined, undefined, false),
      );
      remaining -= partMinutes;
      continue;
    }

    if (free <= 0) continue;

    if (task.splittable) {
      // Place what fits; if remaining < minBlock we still place to avoid
      // tiny remainders sitting unplaced.
      const chunk = Math.min(remaining, free);
      if (chunk < minBlock && remaining > free) continue;
      day.blocks.push(
        buildBlock(inst, candidate, chunk, undefined, undefined, candidate !== wantedDate),
      );
      remaining -= chunk;
    } else {
      // Need to fit whole task on this day
      if (free < remaining) continue;
      day.blocks.push(
        buildBlock(
          inst,
          candidate,
          remaining,
          undefined,
          undefined,
          candidate !== wantedDate,
        ),
      );
      if (candidate !== wantedDate) {
        movedTasks.push({
          instanceKey: inst.instanceKey,
          from: wantedDate,
          to: candidate,
        });
      }
      remaining = 0;
    }
  }

  if (remaining > 0) {
    // Couldn't fit. For non-negotiable: place on preferred date as overload.
    if (allowOverloadOnPreferred && days.has(wantedDate)) {
      const day = days.get(wantedDate)!;
      day.blocks.push(buildBlock(inst, wantedDate, remaining, undefined, undefined, false));
    } else {
      unplaced.push({
        taskId: task.id,
        instanceKey: inst.instanceKey,
        reason: deadlineReason(task, dates) ??
          'No day in range had room for this task — try moving it to next week or splitting it.',
        remainingMinutes: remaining,
      });
    }
  } else if (task.splittable) {
    // Tag split parts with partIndex/partCount
    annotateSplits(days, inst.instanceKey);
  }
}

function buildBlock(
  inst: RecurringInstance,
  date: string,
  minutes: number,
  partIndex: number | undefined,
  partCount: number | undefined,
  movedFromPreferred: boolean,
): ScheduledBlock {
  return {
    id: `task-${inst.instanceKey}-${date}-${Math.random().toString(36).slice(2, 7)}`,
    date,
    minutes,
    kind: 'task',
    taskId: inst.task.id,
    instanceKey: inst.instanceKey,
    movedFromPreferred,
    partIndex,
    partCount,
  };
}

function annotateSplits(days: Map<string, DayPlan>, instanceKey: string) {
  const parts: ScheduledBlock[] = [];
  for (const day of days.values()) {
    for (const b of day.blocks) {
      if (b.instanceKey === instanceKey) parts.push(b);
    }
  }
  if (parts.length <= 1) return;
  parts.sort((a, b) => (a.date < b.date ? -1 : 1));
  parts.forEach((p, i) => {
    p.partIndex = i + 1;
    p.partCount = parts.length;
  });
}

function nearestDateOrder(target: string, dates: string[]): string[] {
  const inRange = dates.includes(target) ? target : dates[0];
  const idx = dates.indexOf(inRange);
  const order: string[] = [inRange];
  for (let step = 1; step < dates.length; step++) {
    const right = idx + step;
    const left = idx - step;
    // Prefer forward in time first (planner-friendly), then backward
    if (right < dates.length) order.push(dates[right]);
    if (left >= 0) order.push(dates[left]);
  }
  return order;
}

function deadlineReason(task: Task, dates: string[]): string | null {
  if (task.deadline && diffDays(task.deadline, dates[dates.length - 1]) < 0) {
    return `Deadline is ${task.deadline} — past the end of this view.`;
  }
  return null;
}

/** Sum of capacity across days */
export function totalCapacity(days: DayPlan[]): number {
  return days.reduce((s, d) => s + d.capacityMinutes, 0);
}

/** Sum of minutes placed across days (buffer-aware, matches what the bar shows). */
export function totalPlanned(days: DayPlan[]): number {
  return days.reduce((s, d) => s + dayLoadMinutes(d), 0);
}

/** Buffer-aware load for a single day — sum of block minutes plus per-task buffer.
 *  Completed blocks are excluded since they no longer consume capacity. */
export function dayLoadMinutes(day: DayPlan): number {
  const buffer = day.bufferMinutes ?? 0;
  const live = day.blocks.filter((b) => !b.completed);
  const blockMins = live.reduce((s, b) => s + b.minutes, 0);
  if (buffer <= 0) return blockMins;
  const taskCount = live.filter((b) => b.kind === 'task').length;
  return blockMins + taskCount * buffer;
}

/** Days that exceed capacity (e.g., manual placements / non-negotiable overflow) */
export function overloadedDays(days: DayPlan[]): DayPlan[] {
  return days.filter((d) => dayLoadMinutes(d) > d.capacityMinutes);
}

/** Compute next N days from a starting ISO date */
export function nextNDates(start: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(start, i));
}

/** Helpful for monthly + quarterly views: aggregate plan into per-day totals */
export interface DaySummary {
  date: string;
  plannedMinutes: number;
  capacityMinutes: number;
  eventCount: number;
  taskCount: number;
  overloaded: boolean;
}

export function summarizeDays(days: DayPlan[]): DaySummary[] {
  return days.map((d) => {
    const planned = dayLoadMinutes(d);
    return {
      date: d.date,
      plannedMinutes: planned,
      capacityMinutes: d.capacityMinutes,
      eventCount: d.blocks.filter((b) => b.kind === 'event').length,
      taskCount: d.blocks.filter((b) => b.kind === 'task').length,
      overloaded: planned > d.capacityMinutes,
    };
  });
}

// Used elsewhere
export { fromISODate, toISODate };
