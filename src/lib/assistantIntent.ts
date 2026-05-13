// Rule-based parser for the natural-language assistant input. Recognizes a
// handful of useful patterns:
//   • "Move <task> to (today|tomorrow|<weekday>)"
//   • "I'm not feeling great" / "easy day today" → halve today's capacity
//   • "Set today's capacity to 4h" / "I have 4 hours today" → explicit cap
// Anything else returns an unrecognized hint.

import type { ScheduledBlock, Task } from '../types';
import { addDays, fromISODate, todayISO } from './dates';

export type IntentResult =
  | { kind: 'success'; message: string }
  | { kind: 'unrecognized'; message: string };

export interface IntentContext {
  tasks: Task[];
  // Scheduled blocks across all visible plans (week + month + quarter), used
  // to find the next instance of a named task.
  upcomingBlocks: ScheduledBlock[];
  setManualPlacement: (instanceKey: string, date: string) => void;
  setCapacityOverride: (date: string, minutes: number, note?: string) => void;
  defaultDailyCapacityMinutes: number;
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const UNWELL_PATTERN =
  /\b(?:not feeling (?:great|good|well|amazing|fantastic|hot|the best)|feeling (?:sick|tired|unwell|terrible|awful|crappy|bad|exhausted|low|off)|i(?:'m| am) (?:tired|sick|exhausted|drained|unwell|burnt out|burned out|wiped|wiped out)|easy day|take it easy|light day|low energy|need a (?:slow|gentle|light|easy) day)\b/;

const HOURS_PATTERN =
  /(?:capacity\s+(?:to|of|at)|to|have|got|give\s+me|set(?:\s+today'?s)?\s+(?:capacity\s+)?to)\s+(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\b|\b(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s+today\b/;

const MOVE_PATTERN =
  /^(?:move|shift|push|reschedule|bump|put)\s+(.+?)\s+(?:to|until|for|on)\s+(.+?)\s*\.?$/;

export function processIntent(raw: string, ctx: IntentContext): IntentResult {
  const text = raw.trim();
  if (!text) return { kind: 'unrecognized', message: '' };
  const lower = text.toLowerCase();

  // 1) Explicit capacity — "set today's capacity to 4h", "I have 4 hours today"
  if (/\b(?:capacity|today|hour|hr|hours)\b/.test(lower)) {
    const m = lower.match(HOURS_PATTERN);
    if (m) {
      const hoursStr = m[1] ?? m[2];
      const hours = parseFloat(hoursStr);
      if (hours > 0 && hours <= 24) {
        const minutes = Math.round(hours * 60);
        ctx.setCapacityOverride(todayISO(), minutes, 'Adjusted via assistant');
        return {
          kind: 'success',
          message: `Today's capacity is now ${formatHours(hours)}. I'll rebalance the negotiable items.`,
        };
      }
    }
  }

  // 2) Feeling unwell / easy day — halve default capacity
  if (UNWELL_PATTERN.test(lower)) {
    const reduced = Math.max(
      30,
      Math.round(ctx.defaultDailyCapacityMinutes / 2),
    );
    ctx.setCapacityOverride(todayISO(), reduced, 'Easy day');
    return {
      kind: 'success',
      message: `Got it — taking it gentle today. Capacity is ${formatHours(reduced / 60)} and I'll shift negotiable items to nearby days.`,
    };
  }

  // 3) Move task
  const move = lower.match(MOVE_PATTERN);
  if (move) {
    const nameFragment = stripFiller(move[1]);
    const dateExpr = move[2].trim();
    const targetDate = resolveDate(dateExpr);
    if (!targetDate) {
      return {
        kind: 'unrecognized',
        message: `I didn't catch when "${dateExpr}" is. Try "today", "tomorrow", or a weekday like "Friday".`,
      };
    }
    const matched = findUpcomingBlock(nameFragment, ctx);
    if (!matched) {
      return {
        kind: 'unrecognized',
        message: `I couldn't find an upcoming task matching "${nameFragment}". Check the name or whether it's already done.`,
      };
    }
    ctx.setManualPlacement(matched.block.instanceKey!, targetDate);
    return {
      kind: 'success',
      message: `Moved "${matched.taskName}" to ${describeDate(targetDate)}.`,
    };
  }

  return {
    kind: 'unrecognized',
    message: `I'm still learning. Try "Move laundry to tomorrow" or "Easy day today".`,
  };
}

function findUpcomingBlock(
  fragment: string,
  ctx: IntentContext,
): { block: ScheduledBlock; taskName: string } | null {
  if (!fragment) return null;
  const today = todayISO();
  const frag = fragment.toLowerCase();
  const taskById = new Map(ctx.tasks.map((t) => [t.id, t]));

  const candidates = ctx.upcomingBlocks
    .filter(
      (b) =>
        b.kind === 'task' &&
        b.instanceKey &&
        b.taskId &&
        b.date >= today,
    )
    .map((b) => {
      const task = taskById.get(b.taskId!);
      if (!task) return null;
      const name = task.name.toLowerCase();
      if (!name.includes(frag)) return null;
      return { block: b, taskName: task.name };
    })
    .filter(
      (x): x is { block: ScheduledBlock; taskName: string } => x !== null,
    );

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.block.date.localeCompare(b.block.date));
  return candidates[0];
}

function resolveDate(expr: string): string | null {
  const cleaned = expr
    .toLowerCase()
    .replace(/^(?:next|this|the)\s+/, '')
    .replace(/[.,!?]+$/, '')
    .trim();
  if (cleaned === 'today') return todayISO();
  if (cleaned === 'tomorrow' || cleaned === 'tmrw' || cleaned === 'tmr')
    return addDays(todayISO(), 1);
  const firstWord = cleaned.split(/\s+/)[0];
  if (firstWord in WEEKDAYS) {
    return nextOccurrence(WEEKDAYS[firstWord]);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(expr.trim())) return expr.trim();
  return null;
}

function nextOccurrence(targetDow: number): string {
  const today = todayISO();
  const todayDow = fromISODate(today).getDay();
  // Always pick the *next* future occurrence (never today, since "move X to
  // monday" when it's already monday usually means the following monday).
  const delta = ((targetDow - todayDow - 1 + 7) % 7) + 1;
  return addDays(today, delta);
}

function stripFiller(s: string): string {
  return s.replace(/^(?:my|the|a|an|some)\s+/i, '').trim();
}

function describeDate(iso: string): string {
  const today = todayISO();
  if (iso === today) return 'today';
  if (iso === addDays(today, 1)) return 'tomorrow';
  return fromISODate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatHours(h: number): string {
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}
