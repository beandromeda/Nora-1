import { usePlanner } from '../../state/usePlanner';
import type { ScheduledBlock } from '../../types';
import { formatDuration, formatLongDate } from '../../lib/dates';
import { Calendar, Lock, Repeat, Trash, X } from '../icons';

interface Props {
  block: ScheduledBlock;
  onClose: () => void;
}

export function TaskDetailModal({ block, onClose }: Props) {
  const {
    tasks,
    events,
    deleteTask,
    deleteEvent,
    toggleInstanceComplete,
    clearManualPlacement,
    completedInstances,
  } = usePlanner();

  const isEvent = block.kind === 'event';
  const event = isEvent ? events.find((e) => e.id === block.eventId) : null;
  const task = !isEvent ? tasks.find((t) => t.id === block.taskId) : null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-[480px] max-w-[92vw] p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 p-1.5 rounded-md text-ink-400 hover:bg-sand-200"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div
            className={
              'w-10 h-10 rounded-xl grid place-items-center ' +
              (isEvent
                ? 'bg-lavender-100 text-lavender-500'
                : task?.priority === 'non-negotiable'
                  ? 'bg-clay-100 text-clay-400'
                  : 'bg-sky-100 text-sky-500')
            }
          >
            {isEvent ? (
              <Calendar className="w-5 h-5" />
            ) : task?.priority === 'non-negotiable' ? (
              <Lock className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="font-display text-xl text-ink-900">
              {isEvent ? event?.title : task?.name}
            </div>
            <div className="text-sm text-ink-500 mt-0.5">
              {formatLongDate(block.date)} · {formatDuration(block.minutes)}
              {block.partCount && block.partCount > 1
                ? ` · part ${block.partIndex} of ${block.partCount}`
                : ''}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          {isEvent && event && (
            <>
              <Field label="Source">
                {event.source === 'google' ? 'Google Calendar' : 'Mock event'}
              </Field>
              <Field label="Time">
                {new Date(event.start).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}{' '}
                –{' '}
                {new Date(event.end).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Field>
              {event.notes && <Field label="Notes">{event.notes}</Field>}
            </>
          )}
          {task && (
            <>
              <Field label="Priority">
                <span
                  className={
                    'pill ' +
                    (task.priority === 'non-negotiable'
                      ? 'bg-clay-100 text-clay-400'
                      : 'bg-sand-100 text-ink-500')
                  }
                >
                  {task.priority === 'non-negotiable'
                    ? 'Non-negotiable'
                    : 'Negotiable'}
                </span>
              </Field>
              <Field label="Type">
                {task.kind === 'recurring'
                  ? `Recurring · ${task.recurrence?.frequency}`
                  : 'One-time'}
              </Field>
              <Field label="Estimated">
                {formatDuration(task.estimatedMinutes)}
              </Field>
              {task.deadline && <Field label="Deadline">{task.deadline}</Field>}
              {task.notes && <Field label="Notes">{task.notes}</Field>}
              {block.movedFromPreferred && (
                <div className="text-sm text-ink-500 italic">
                  This was moved from a busier day to keep capacity
                  comfortable.
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-between items-center mt-6 gap-2">
          <button
            onClick={() => {
              if (isEvent && event) {
                deleteEvent(event.id);
              } else if (task) {
                deleteTask(task.id);
              }
              onClose();
            }}
            className="btn-ghost text-rose-500 hover:bg-rose-100"
          >
            <Trash className="w-4 h-4" />
            Delete
          </button>
          <div className="flex gap-2">
            {!isEvent && block.instanceKey && (
              <>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    clearManualPlacement(block.instanceKey!);
                    onClose();
                  }}
                >
                  Auto-place
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    toggleInstanceComplete(block.instanceKey!);
                    onClose();
                  }}
                >
                  {completedInstances[block.instanceKey] ? 'Reopen' : 'Mark done'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <div className="w-24 text-xs uppercase tracking-wide text-ink-400 font-semibold">
        {label}
      </div>
      <div className="text-ink-700">{children}</div>
    </div>
  );
}
