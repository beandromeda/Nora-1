// Plain-English summary generator. Reads a PlanResult and produces a short
// list of suggestions. Tone: warm, factual, never guilt-inducing.

import type { PlanResult, Task, CapacityOverride } from '../types';
import { formatDuration, formatLongDate, formatShortDate } from './dates';

export interface AssistantMessage {
  id: string;
  tone: 'info' | 'positive' | 'attention' | 'gentle';
  title: string;
  body: string;
}

export interface AssistantInput {
  plan: PlanResult;
  tasks: Task[];
  capacityOverrides: CapacityOverride[];
  // The most-recent override (drives "today's capacity changed" message).
  recentOverride?: CapacityOverride;
}

export function buildAssistantMessages(input: AssistantInput): AssistantMessage[] {
  const { plan, tasks, recentOverride } = input;
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const messages: AssistantMessage[] = [];

  // Capacity-override callout
  if (recentOverride) {
    const movedToday = plan.movedTasks.filter((m) => m.from === recentOverride.date);
    const dayName = formatLongDate(recentOverride.date);
    const hours = formatDuration(recentOverride.minutes);
    const movedNames = movedToday
      .map((m) => taskById.get(parseTaskId(m.instanceKey))?.name)
      .filter((n): n is string => Boolean(n));
    const body =
      movedNames.length > 0
        ? `${dayName}'s capacity is ${hours}. Your non-negotiable items are still in place. I moved ${formatList(
            movedNames,
          )} to nearby days where there's room.`
        : `${dayName}'s capacity is ${hours}. Everything still fits — take it gently.`;
    messages.push({
      id: 'capacity-override',
      tone: 'gentle',
      title: 'Capacity adjusted',
      body,
    });
  }

  // Per-day overload notes
  const overloadedDays = plan.days.filter(
    (d) => d.blocks.reduce((s, b) => s + b.minutes, 0) > d.capacityMinutes,
  );
  for (const day of overloadedDays) {
    const used = day.blocks.reduce((s, b) => s + b.minutes, 0);
    const over = used - day.capacityMinutes;
    const eventBlocks = day.blocks.filter((b) => b.kind === 'event');
    const eventMinutes = eventBlocks.reduce((s, b) => s + b.minutes, 0);
    const driver =
      eventMinutes > day.capacityMinutes / 2
        ? `you have ${formatDuration(eventMinutes)} of fixed events`
        : `there are several tasks scheduled`;

    const movedToHere = plan.movedTasks
      .filter((m) => m.to === day.date)
      .map((m) => taskById.get(parseTaskId(m.instanceKey))?.name)
      .filter((n): n is string => Boolean(n));

    const moveSentence =
      movedToHere.length > 0
        ? ` I shifted ${formatList(movedToHere)} here from nearby days.`
        : '';

    messages.push({
      id: `overload-${day.date}`,
      tone: 'attention',
      title: `${formatLongDate(day.date)} is over capacity`,
      body: `${capitalize(driver)}, putting the day ${formatDuration(over)} over your limit.${moveSentence} Consider reviewing the negotiable items below.`,
    });
  }

  // Movements summary (consolidated)
  if (plan.movedTasks.length > 0 && overloadedDays.length === 0) {
    const moves = plan.movedTasks.slice(0, 4).map((m) => {
      const name = taskById.get(parseTaskId(m.instanceKey))?.name ?? 'a task';
      return `${name} → ${formatShortDate(m.to)}`;
    });
    messages.push({
      id: 'auto-moves',
      tone: 'info',
      title: 'I rebalanced your week',
      body: `To keep every day inside your capacity, I moved: ${moves.join(
        ', ',
      )}${plan.movedTasks.length > 4 ? ', and a few more.' : '.'}`,
    });
  }

  // Unplaced
  if (plan.unplaced.length > 0) {
    const names = plan.unplaced
      .map((u) => taskById.get(u.taskId)?.name)
      .filter((n): n is string => Boolean(n))
      .slice(0, 3);
    messages.push({
      id: 'unplaced',
      tone: 'attention',
      title: 'A few items couldn\'t find a home this week',
      body: `${formatList(names)} ${
        plan.unplaced.length > 3 ? 'and others ' : ''
      }could not fit in this view. They're safe in your backlog — try moving them to next week, splitting them, or relaxing a deadline.`,
    });
  }

  // Empty / calm state
  if (messages.length === 0) {
    messages.push({
      id: 'calm',
      tone: 'positive',
      title: 'You\'re in good shape',
      body: 'Every day is comfortably within capacity. Nothing needs rescheduling — enjoy the breathing room.',
    });
  }

  return messages;
}

function parseTaskId(instanceKey: string): string {
  return instanceKey.split('__')[0];
}

function formatList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Summarize a single plan in one short sentence. Useful for the very top of
 * the assistant panel.
 */
export function planSummary(plan: PlanResult): string {
  const totalCap = plan.days.reduce((s, d) => s + d.capacityMinutes, 0);
  const totalPlanned = plan.days.reduce(
    (s, d) => s + d.blocks.reduce((x, b) => x + b.minutes, 0),
    0,
  );
  const pct = totalCap === 0 ? 0 : Math.round((totalPlanned / totalCap) * 100);
  if (pct > 100)
    return `This view is over capacity by ${formatDuration(totalPlanned - totalCap)}.`;
  if (pct >= 85)
    return `This view is busy — about ${pct}% of capacity is planned.`;
  if (pct >= 50) return `Comfortable load — about ${pct}% of capacity planned.`;
  return `Lots of room — about ${pct}% of capacity planned.`;
}
