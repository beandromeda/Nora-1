import clsx from 'clsx';
import { useDroppable } from '@dnd-kit/core';
import type { CalendarEvent, DayPlan, ScheduledBlock, Task } from '../types';
import { localTimeFromISO } from '../lib/dates';
import { TaskBlock } from './tasks/TaskBlock';

interface Props {
  day: DayPlan;
  taskById: Map<string, Task>;
  eventById: Map<string, CalendarEvent>;
  onSelectBlock: (blockId: string) => void;
  onCompleteInstance: (instanceKey: string) => void;
}

// Hour slots shown in the Daily view's time grid. The user asked for 7 AM
// through 10 PM — inclusive on both ends, so 16 hourly rows starting at each
// labelled hour.  Anything scheduled outside this window is clipped into the
// visible range.
const FIRST_HOUR = 7;   // 7 AM
const LAST_HOUR = 22;   // 10 PM
const SLOT_HOURS = Array.from(
  { length: LAST_HOUR - FIRST_HOUR + 1 },
  (_, i) => FIRST_HOUR + i,
);

// Vertical scale: how many pixels each hour occupies.  Together with the
// block's `minutes` this lets a 9-hour shift visually span 9 rows.
const HOUR_HEIGHT = 56;
const PX_PER_MIN = HOUR_HEIGHT / 60;
const GRID_HEIGHT = SLOT_HOURS.length * HOUR_HEIGHT;
// Very short blocks (15-min, 30-min) still need to be tall enough to read the
// title — collapse below this and they're useless.
const MIN_BLOCK_HEIGHT = 28;

function formatHourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

function blockStartTime(
  block: ScheduledBlock,
  event: CalendarEvent | undefined,
): string | null {
  if (block.kind === 'event' && event) return localTimeFromISO(event.start);
  if (block.scheduledTime) return block.scheduledTime;
  return null;
}

function timeToOffsetMin(time: string): number {
  const [hh, mm] = time.split(':').map(Number);
  return (hh - FIRST_HOUR) * 60 + (mm || 0);
}

// Clamps a (start, duration) pair into the visible grid window, returning
// pixel offset + height.  Items that start before 7 AM stick to the top;
// items that overflow past 10 PM are truncated to the grid floor.
function placement(startTime: string, minutes: number) {
  const rawTop = timeToOffsetMin(startTime) * PX_PER_MIN;
  const rawHeight = Math.max(MIN_BLOCK_HEIGHT, minutes * PX_PER_MIN);
  const top = Math.max(0, Math.min(rawTop, GRID_HEIGHT - MIN_BLOCK_HEIGHT));
  const remaining = GRID_HEIGHT - top;
  const height = Math.max(MIN_BLOCK_HEIGHT, Math.min(rawHeight, remaining));
  return { top, height };
}

export function DayTimeGrid({
  day,
  taskById,
  eventById,
  onSelectBlock,
  onCompleteInstance,
}: Props) {
  // Split blocks into Unscheduled (no anchor time) vs. Scheduled (anchored).
  // Events always anchor to their start; tasks anchor only when pinned.
  const unscheduled: ScheduledBlock[] = [];
  const scheduled: { block: ScheduledBlock; start: string }[] = [];

  for (const block of day.blocks) {
    const ev = block.eventId ? eventById.get(block.eventId) : undefined;
    const start = blockStartTime(block, ev);
    if (start === null) unscheduled.push(block);
    else scheduled.push({ block, start });
  }

  // Stable visual order: by start time, then events before tasks for ties.
  scheduled.sort((a, b) => {
    if (a.start !== b.start) return a.start.localeCompare(b.start);
    if (a.block.kind !== b.block.kind) return a.block.kind === 'event' ? -1 : 1;
    return 0;
  });

  const renderBlock = (block: ScheduledBlock, stretched: boolean) => (
    <TaskBlock
      block={block}
      task={block.taskId ? taskById.get(block.taskId) : undefined}
      event={block.eventId ? eventById.get(block.eventId) : undefined}
      onClick={() => onSelectBlock(block.id)}
      onComplete={
        block.instanceKey
          ? () => onCompleteInstance(block.instanceKey!)
          : undefined
      }
      stretched={stretched}
    />
  );

  return (
    <div className="card overflow-hidden">
      <UnscheduledLane date={day.date}>
        {unscheduled.length === 0 ? (
          <div className="text-xs text-ink-300 italic px-1 py-2">
            Drop tasks here to leave them unscheduled — or drag into a time
            slot below.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((b) => (
              <div key={b.id} className="min-w-[180px] max-w-[260px]">
                {renderBlock(b, false)}
              </div>
            ))}
          </div>
        )}
      </UnscheduledLane>

      <div className="flex">
        {/* Hour labels — fixed-width left rail. */}
        <div className="w-16 flex-shrink-0 border-r border-sand-200">
          {SLOT_HOURS.map((h) => (
            <div
              key={h}
              className="px-3 text-[11px] font-medium text-ink-400 tabular-nums"
              style={{ height: HOUR_HEIGHT }}
            >
              <div className="-mt-1.5">{formatHourLabel(h)}</div>
            </div>
          ))}
        </div>

        {/* Grid body — drop zones underneath, scheduled blocks layered on
            top.  Both are absolutely positioned within this relative box so
            the height of a block reflects its duration. */}
        <div className="flex-1 relative" style={{ height: GRID_HEIGHT }}>
          {SLOT_HOURS.map((h, i) => (
            <HourDropZone
              key={h}
              date={day.date}
              hour={h}
              top={i * HOUR_HEIGHT}
              height={HOUR_HEIGHT}
              showDivider={i > 0}
            />
          ))}
          {scheduled.map(({ block, start }) => {
            const { top, height } = placement(start, block.minutes);
            return (
              <div
                key={block.id}
                className="absolute left-1 right-1 pointer-events-auto"
                style={{ top, height }}
              >
                {renderBlock(block, true)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UnscheduledLane({
  date,
  children,
}: {
  date: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `unscheduled-${date}`,
    data: { date, kind: 'unscheduled' },
  });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'px-4 py-3 border-b border-sand-200 bg-sand-50/60 transition-colors',
        isOver && 'bg-sage-100/60 ring-2 ring-sage-300 ring-inset',
      )}
    >
      <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400 mb-2">
        Unscheduled
      </div>
      {children}
    </div>
  );
}

function HourDropZone({
  date,
  hour,
  top,
  height,
  showDivider,
}: {
  date: string;
  hour: number;
  top: number;
  height: number;
  showDivider: boolean;
}) {
  const hh = String(hour).padStart(2, '0');
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${date}-${hh}`,
    data: { date, kind: 'slot', hour: `${hh}:00` },
  });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'absolute left-0 right-0 transition-colors',
        showDivider && 'border-t border-sand-200',
        isOver && 'bg-sage-100/50',
      )}
      style={{ top, height }}
    />
  );
}
