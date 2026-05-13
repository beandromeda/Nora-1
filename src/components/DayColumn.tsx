import clsx from 'clsx';
import { useDroppable } from '@dnd-kit/core';
import type { CalendarEvent, DayPlan, Task } from '../types';
import {
  fromISODate,
  formatDuration,
  getDayOfWeek,
  todayISO,
  WEEKDAYS_SHORT,
} from '../lib/dates';
import { dayLoadMinutes } from '../lib/planner';
import { CapacityBar } from './CapacityBar';
import { TaskBlock } from './tasks/TaskBlock';
import { Heart } from './icons';

interface Props {
  day: DayPlan;
  taskById: Map<string, Task>;
  eventById: Map<string, CalendarEvent>;
  onSelectBlock: (blockId: string) => void;
  onCompleteInstance: (instanceKey: string) => void;
  onAdjustCapacity: (date: string) => void;
  warnThreshold?: number;
}

/**
 * DayRow — full-width horizontal row for a single day in the weekly view.
 * Left: fixed-width day strip (label + capacity bar). Right: blocks flow
 * horizontally with flex-wrap so titles get room to breathe.
 */
export function DayColumn({
  day,
  taskById,
  eventById,
  onSelectBlock,
  onCompleteInstance,
  onAdjustCapacity,
  warnThreshold = 100,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.date}`,
    data: { date: day.date },
  });

  const planned = dayLoadMinutes(day);
  const overloaded = planned > day.capacityMinutes;
  const isToday = day.date === todayISO();
  const dow = getDayOfWeek(day.date);
  const dayNum = fromISODate(day.date).getDate();

  // Sort blocks: events first (start time order), then tasks (priority).
  const sorted = [...day.blocks].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'event' ? -1 : 1;
    if (a.kind === 'event' && b.kind === 'event') {
      const ea = eventById.get(a.eventId!);
      const eb = eventById.get(b.eventId!);
      return (ea?.start ?? '').localeCompare(eb?.start ?? '');
    }
    const ta = taskById.get(a.taskId!);
    const tb = taskById.get(b.taskId!);
    if (!ta || !tb) return 0;
    if (ta.priority !== tb.priority)
      return ta.priority === 'non-negotiable' ? -1 : 1;
    return tb.estimatedMinutes - ta.estimatedMinutes;
  });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'flex rounded-2xl border transition-colors min-h-[96px]',
        overloaded
          ? 'bg-rose-100/40 border-rose-200'
          : 'bg-sand-100 border-sand-200',
        isOver && 'ring-2 ring-sage-300 ring-offset-2 ring-offset-sand-50',
      )}
    >
      {/* Day strip (left) */}
      <div className="w-44 flex-shrink-0 px-3 py-3 border-r border-sand-200 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <div
              className={clsx(
                'text-[11px] uppercase tracking-wider font-semibold',
                isToday ? 'text-sage-600' : 'text-ink-400',
              )}
            >
              {WEEKDAYS_SHORT[dow]}
            </div>
            <div
              className={clsx(
                'font-display text-2xl leading-none',
                isToday ? 'text-sage-700' : 'text-ink-900',
              )}
            >
              {dayNum}
            </div>
          </div>
          <button
            onClick={() => onAdjustCapacity(day.date)}
            className={clsx(
              'p-1 rounded-md hover:bg-sand-200 transition-colors',
              day.capacityOverridden ? 'text-rose-400' : 'text-ink-300',
            )}
            title="Adjust day's capacity"
          >
            <Heart className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2">
          <CapacityBar
            plannedMinutes={planned}
            capacityMinutes={day.capacityMinutes}
            size="sm"
            warnThreshold={warnThreshold}
          />
        </div>
        {day.capacityOverridden && (
          <div className="text-[10px] text-rose-400 mt-1.5 italic">
            Adjusted to {formatDuration(day.capacityMinutes)}
          </div>
        )}
      </div>

      {/* Blocks (right) */}
      <div className="flex-1 p-2 min-w-0">
        {sorted.length === 0 ? (
          <div className="h-full grid place-items-center text-xs text-ink-300 italic py-4">
            Open day
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sorted.map((block) => (
              <div
                key={block.id}
                className="min-w-[180px] max-w-[260px] flex-shrink-0"
              >
                <TaskBlock
                  block={block}
                  task={block.taskId ? taskById.get(block.taskId) : undefined}
                  event={
                    block.eventId ? eventById.get(block.eventId) : undefined
                  }
                  onClick={() => onSelectBlock(block.id)}
                  onComplete={
                    block.instanceKey
                      ? () => onCompleteInstance(block.instanceKey!)
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
