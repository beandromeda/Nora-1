// Frontend client for the Claude-powered planning assistant. Sends a compact
// snapshot of the user's tasks/events/upcoming plan to the backend, receives
// back a reply + a list of structured actions to apply against planner state.

import type {
  AppSettings,
  CalendarEvent,
  CapacityOverride,
  PlanResult,
  Task,
} from '../types';
import {
  addDays,
  fromISODate,
  localDateFromISO,
  todayISO,
  WEEKDAYS_LONG,
} from './dates';
import { instanceKey as makeInstanceKey } from './recurrence';

export interface AssistantAction {
  name: string;
  input: Record<string, unknown>;
}

export interface AssistantApiResponse {
  reply: string;
  actions: AssistantAction[];
}

export interface SnapshotInput {
  tasks: Task[];
  events: CalendarEvent[];
  capacityOverrides: CapacityOverride[];
  settings: AppSettings;
  weeklyPlan: PlanResult;
  monthlyPlan: PlanResult;
}

export interface PlannerActions {
  addTask: (t: Omit<Task, 'id' | 'createdAt'>) => void;
  addEvent: (e: Omit<CalendarEvent, 'id'>) => void;
  deleteEvent: (id: string) => void;
  setCapacityOverride: (date: string, minutes: number, note?: string) => void;
  setManualPlacement: (instanceKey: string, date: string) => void;
  toggleInstanceComplete: (instanceKey: string) => void;
  // Snapshot data needed to resolve names → ids and to build instance keys
  // when the model passes a (task_id, instance_date) pair.
  events: CalendarEvent[];
}

export async function callAssistant(
  message: string,
  snapshot: SnapshotInput,
): Promise<AssistantApiResponse> {
  const compact = buildSnapshot(snapshot);
  const res = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, snapshot: compact }),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { error?: string };
      detail = body.error ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(
      detail || `Assistant request failed (${res.status}). Is the API server running?`,
    );
  }
  return (await res.json()) as AssistantApiResponse;
}

// Build a small, structured snapshot focused on what the LLM needs to make
// good decisions. Keep it compact to limit token cost.
function buildSnapshot(input: SnapshotInput) {
  const today = todayISO();
  const horizon = addDays(today, 14);

  // Precomputed date table so the model never has to do weekday math.
  // The model is told to look up dates here rather than inferring them.
  const calendarLookup: Array<{
    date: string;
    weekday: string;
    label?: string;
  }> = [];
  for (let i = 0; i <= 14; i++) {
    const iso = addDays(today, i);
    const entry: { date: string; weekday: string; label?: string } = {
      date: iso,
      weekday: WEEKDAYS_LONG[fromISODate(iso).getDay()],
    };
    if (i === 0) entry.label = 'today';
    else if (i === 1) entry.label = 'tomorrow';
    calendarLookup.push(entry);
  }
  const todayWeekday = calendarLookup[0].weekday;
  const tomorrow = calendarLookup[1].date;
  const tomorrowWeekday = calendarLookup[1].weekday;

  const tasks = input.tasks.map((t) => ({
    id: t.id,
    name: t.name,
    kind: t.kind,
    priority: t.priority,
    estimated_minutes: t.estimatedMinutes,
    splittable: t.splittable,
    recurrence: t.recurrence,
    preferred_date: t.preferredDate,
    deadline: t.deadline,
    notes: t.notes,
  }));

  // Pull blocks across the next ~14 days from weekly + monthly plans, deduped.
  const seen = new Set<string>();
  const upcoming: Array<{
    date: string;
    task_id?: string;
    task_name?: string;
    event_id?: string;
    event_title?: string;
    minutes: number;
    instance_key?: string;
  }> = [];
  const taskById = new Map(input.tasks.map((t) => [t.id, t]));
  const eventById = new Map(input.events.map((e) => [e.id, e]));
  for (const plan of [input.weeklyPlan, input.monthlyPlan]) {
    for (const day of plan.days) {
      if (day.date < today || day.date > horizon) continue;
      for (const b of day.blocks) {
        const dedupeKey = b.instanceKey ?? `${day.date}__${b.id}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        if (b.kind === 'task') {
          upcoming.push({
            date: day.date,
            task_id: b.taskId,
            task_name: b.taskId ? taskById.get(b.taskId)?.name : undefined,
            minutes: b.minutes,
            instance_key: b.instanceKey,
          });
        } else {
          upcoming.push({
            date: day.date,
            event_id: b.eventId,
            event_title: b.eventId ? eventById.get(b.eventId)?.title : undefined,
            minutes: b.minutes,
          });
        }
      }
    }
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  const eventsSoon = input.events
    .filter((e) => {
      const d = localDateFromISO(e.start);
      return d >= today && d <= horizon;
    })
    .map((e) => ({ id: e.id, title: e.title, start: e.start, end: e.end }));

  const recentOverrides = input.capacityOverrides
    .filter((o) => o.date >= addDays(today, -3))
    .slice(-10);

  return {
    today,
    today_weekday: todayWeekday,
    tomorrow,
    tomorrow_weekday: tomorrowWeekday,
    calendar_lookup: calendarLookup,
    default_daily_capacity_hours: input.settings.defaultDailyCapacityMinutes / 60,
    week_starts_on: input.settings.weekStartsOn,
    tasks,
    upcoming_blocks: upcoming,
    upcoming_events: eventsSoon,
    recent_capacity_overrides: recentOverrides,
  };
}

// ---------- Action dispatcher --------------------------------------------

export interface DispatchResult {
  applied: string[];   // human-readable bullets
  errors: string[];
}

export function dispatchActions(
  actions: AssistantAction[],
  ctx: PlannerActions,
): DispatchResult {
  const applied: string[] = [];
  const errors: string[] = [];

  for (const action of actions) {
    try {
      switch (action.name) {
        case 'move_task': {
          const taskId = String(action.input.task_id ?? '');
          const instanceDate = String(action.input.instance_date ?? '');
          const newDate = String(action.input.new_date ?? '');
          if (!taskId || !instanceDate || !newDate)
            throw new Error('move_task missing fields');
          const key = makeInstanceKey(taskId, instanceDate);
          ctx.setManualPlacement(key, newDate);
          applied.push(`Moved task to ${newDate}`);
          break;
        }
        case 'set_capacity': {
          const date = String(action.input.date ?? todayISO());
          const hours = Number(action.input.hours);
          if (!Number.isFinite(hours) || hours < 0 || hours > 24)
            throw new Error('set_capacity: hours out of range');
          const reason =
            typeof action.input.reason === 'string'
              ? (action.input.reason as string)
              : undefined;
          ctx.setCapacityOverride(date, Math.round(hours * 60), reason);
          applied.push(`Set capacity for ${date} to ${hours}h`);
          break;
        }
        case 'complete_task_instance': {
          const taskId = String(action.input.task_id ?? '');
          const instanceDate = String(action.input.instance_date ?? '');
          if (!taskId || !instanceDate)
            throw new Error('complete_task_instance missing fields');
          ctx.toggleInstanceComplete(makeInstanceKey(taskId, instanceDate));
          applied.push(`Marked task complete on ${instanceDate}`);
          break;
        }
        case 'add_task': {
          const name = String(action.input.name ?? '').trim();
          const minutes = Number(action.input.estimated_minutes);
          const priority = action.input.priority === 'non-negotiable'
            ? 'non-negotiable'
            : 'negotiable';
          const kind = action.input.kind === 'recurring' ? 'recurring' : 'one-time';
          if (!name || !Number.isFinite(minutes))
            throw new Error('add_task missing fields');
          const recurrence =
            kind === 'recurring' && action.input.recurrence_frequency
              ? {
                  frequency: action.input.recurrence_frequency as
                    | 'daily'
                    | 'weekdays'
                    | 'weekends'
                    | 'weekly'
                    | 'biweekly'
                    | 'monthly'
                    | 'quarterly',
                  dayOfWeek:
                    typeof action.input.day_of_week === 'number'
                      ? (action.input.day_of_week as number)
                      : undefined,
                  dayOfMonth:
                    typeof action.input.day_of_month === 'number'
                      ? (action.input.day_of_month as number)
                      : undefined,
                }
              : undefined;
          ctx.addTask({
            name,
            estimatedMinutes: Math.max(5, Math.round(minutes)),
            priority,
            kind,
            recurrence,
            preferredDate:
              typeof action.input.preferred_date === 'string'
                ? (action.input.preferred_date as string)
                : undefined,
            deadline:
              typeof action.input.deadline === 'string'
                ? (action.input.deadline as string)
                : undefined,
            preferredDayOfWeek:
              recurrence?.frequency === 'weekly' ||
              recurrence?.frequency === 'biweekly'
                ? recurrence.dayOfWeek
                : undefined,
            splittable: Boolean(action.input.splittable),
          });
          applied.push(`Added task "${name}"`);
          break;
        }
        case 'add_event': {
          const title = String(action.input.title ?? '').trim();
          const start = String(action.input.start ?? '');
          const end = String(action.input.end ?? '');
          if (!title || !start || !end)
            throw new Error('add_event missing fields');
          ctx.addEvent({
            title,
            start,
            end,
            notes:
              typeof action.input.notes === 'string'
                ? (action.input.notes as string)
                : undefined,
          });
          applied.push(`Added event "${title}"`);
          break;
        }
        case 'delete_event': {
          const id = String(action.input.event_id ?? '');
          if (!id) throw new Error('delete_event missing event_id');
          const evt = ctx.events.find((e) => e.id === id);
          ctx.deleteEvent(id);
          applied.push(`Removed event "${evt?.title ?? id}"`);
          break;
        }
        default:
          errors.push(`Unknown action: ${action.name}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      errors.push(`${action.name}: ${msg}`);
    }
  }

  return { applied, errors };
}
