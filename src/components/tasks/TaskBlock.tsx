import clsx from 'clsx';
import { useDraggable } from '@dnd-kit/core';
import type { CSSProperties } from 'react';
import type { CalendarEvent, ScheduledBlock, Task } from '../../types';
import { formatDuration } from '../../lib/dates';
import {
  Calendar,
  Check,
  Lock,
  Move as MoveIcon,
  Repeat,
} from '../icons';

interface Props {
  block: ScheduledBlock;
  task?: Task;
  event?: CalendarEvent;
  onClick?: () => void;
  onComplete?: () => void;
  draggable?: boolean;
  compact?: boolean;
  // When true the block fills its parent's full width and height — used by the
  // time-grid where the wrapper is sized by the block's duration.
  stretched?: boolean;
}

export function TaskBlock({
  block,
  task,
  event,
  onClick,
  onComplete,
  draggable = true,
  compact = false,
  stretched = false,
}: Props) {
  const isEvent = block.kind === 'event';
  const isCompleted = Boolean(block.completed);
  // Events are anchored to a real calendar time; completed work shouldn't be
  // re-dragged (re-open it first by un-checking).
  const isFixed = isEvent || isCompleted;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: block.id,
      data: { instanceKey: block.instanceKey, fromDate: block.date },
      disabled: isFixed || !draggable,
    });

  const style: CSSProperties | undefined = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
      }
    : undefined;

  const isNonNeg = task?.priority === 'non-negotiable';
  const isRecurring = task?.kind === 'recurring';
  const isMoved = block.movedFromPreferred;
  const split = block.partCount && block.partCount > 1;

  const titleText = isEvent ? event?.title ?? 'Event' : task?.name ?? 'Task';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'group relative rounded-xl border px-3 py-2 transition-shadow text-left select-none overflow-hidden',
        compact ? 'text-xs py-1.5' : 'text-sm',
        stretched && 'h-full w-full',
        isCompleted
          ? 'bg-sand-100 border-sand-200 text-ink-400'
          : isEvent
            ? 'bg-lavender-100 border-lavender-300 text-ink-900'
            : isNonNeg
              ? 'bg-clay-100 border-clay-200 text-ink-900'
              : 'bg-sky-100 border-sky-300 text-ink-900 hover:border-sky-400',
        isDragging && 'shadow-lift cursor-grabbing opacity-90',
        !isFixed && draggable && 'cursor-grab',
      )}
      onClick={onClick}
      {...(draggable && !isFixed ? listeners : {})}
      {...(draggable && !isFixed ? attributes : {})}
    >
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">
          {isCompleted ? (
            <Check className="w-3.5 h-3.5 text-sage-500" />
          ) : isEvent ? (
            <Calendar className="w-3.5 h-3.5 text-lavender-500" />
          ) : isNonNeg ? (
            <Lock className="w-3.5 h-3.5 text-clay-400" />
          ) : isRecurring ? (
            <Repeat className="w-3.5 h-3.5 text-sky-500" />
          ) : (
            <MoveIcon className="w-3.5 h-3.5 text-sky-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={clsx(
              'font-medium truncate leading-snug',
              isCompleted && 'line-through',
            )}
          >
            {titleText}
            {split && (
              <span className="ml-1 text-[10px] text-ink-400 font-normal">
                {block.partIndex}/{block.partCount}
              </span>
            )}
          </div>
          {!compact && (
            <div className="text-[11px] text-ink-500 flex items-center gap-2 mt-0.5">
              <span>{formatDuration(block.minutes)}</span>
              {isMoved && !isCompleted && (
                <span className="pill bg-sand-100 text-ink-500 text-[10px]">
                  moved
                </span>
              )}
              {isCompleted && (
                <span className="pill bg-sage-100 text-sage-600 text-[10px]">
                  done
                </span>
              )}
            </div>
          )}
        </div>
        {onComplete && !compact && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onComplete();
            }}
            className={clsx(
              'p-1 rounded-md transition-opacity hover:bg-sand-200',
              isCompleted
                ? 'opacity-100 text-sage-500'
                : 'opacity-0 group-hover:opacity-100 text-ink-400',
            )}
            aria-label={isCompleted ? 'Mark not done' : 'Mark complete'}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
