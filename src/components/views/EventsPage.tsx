import { useMemo, useState } from 'react';
import clsx from 'clsx';

import { usePlanner } from '../../state/usePlanner';
import { formatLongDate, localDateFromISO, todayISO } from '../../lib/dates';
import type { CalendarEvent, EventRecurrenceFrequency } from '../../types';
import { Calendar, Pencil, Plus, Repeat, Trash, X } from '../icons';

export function EventsPage() {
  const { events, addEvent, updateEvent, deleteEvent } = usePlanner();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const today = todayISO();
  const recurring = useMemo(
    () =>
      events
        .filter((e) => !!e.recurrence)
        .sort((a, b) => {
          // Sort by month/day so birthdays land in calendar order.
          const ad = new Date(a.start);
          const bd = new Date(b.start);
          const am = ad.getMonth() * 31 + ad.getDate();
          const bm = bd.getMonth() * 31 + bd.getDate();
          return am - bm || a.title.localeCompare(b.title);
        }),
    [events],
  );
  const oneTime = useMemo(
    () =>
      events
        .filter((e) => !e.recurrence)
        .sort((a, b) => a.start.localeCompare(b.start)),
    [events],
  );
  const upcoming = oneTime.filter((e) => localDateFromISO(e.start) >= today);
  const past = oneTime
    .filter((e) => localDateFromISO(e.start) < today)
    .reverse();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="font-display text-3xl text-ink-900">Events</div>
          <div className="text-sm text-ink-500 mt-1">
            All your fixed calendar items in one place. They anchor each day's
            plan.
          </div>
        </div>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setEditingId(null);
          }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'Close' : 'Add event'}
        </button>
      </div>

      {showForm && (
        <EventForm
          mode="create"
          onCancel={() => setShowForm(false)}
          onSubmit={(payload) => {
            addEvent(payload);
            setShowForm(false);
          }}
        />
      )}

      {events.length === 0 && !showForm ? (
        <div className="card p-10 text-center">
          <div className="font-display text-xl text-ink-900">
            No events yet
          </div>
          <div className="text-sm text-ink-500 mt-1">
            Add appointments, meetings, or anything time-bound. They'll show up
            on the right day.
          </div>
        </div>
      ) : (
        <>
          {recurring.length > 0 && (
            <Group title="Recurring" emptyText="">
              {recurring.map((e) =>
                editingId === e.id ? (
                  <EventForm
                    key={e.id}
                    mode="edit"
                    initial={e}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(payload) => {
                      updateEvent(e.id, payload);
                      setEditingId(null);
                    }}
                  />
                ) : (
                  <EventRow
                    key={e.id}
                    event={e}
                    onEdit={() => setEditingId(e.id)}
                    onDelete={() => deleteEvent(e.id)}
                  />
                ),
              )}
            </Group>
          )}

          <Group title="Upcoming" emptyText="Nothing coming up.">
            {upcoming.map((e) =>
              editingId === e.id ? (
                <EventForm
                  key={e.id}
                  mode="edit"
                  initial={e}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(payload) => {
                    updateEvent(e.id, payload);
                    setEditingId(null);
                  }}
                />
              ) : (
                <EventRow
                  key={e.id}
                  event={e}
                  onEdit={() => setEditingId(e.id)}
                  onDelete={() => deleteEvent(e.id)}
                />
              ),
            )}
          </Group>

          {past.length > 0 && (
            <Group title="Past" emptyText="">
              {past.map((e) => (
                <EventRow
                  key={e.id}
                  event={e}
                  faded
                  onEdit={() => setEditingId(e.id)}
                  onDelete={() => deleteEvent(e.id)}
                />
              ))}
            </Group>
          )}
        </>
      )}
    </div>
  );
}

function EventRow({
  event,
  faded,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  faded?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const sameDay = localDateFromISO(event.start) === localDateFromISO(event.end);
  const time = sameDay
    ? `${start.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : `${start.toLocaleString()} → ${end.toLocaleString()}`;

  return (
    <div
      className={clsx(
        'card p-4 flex items-center gap-3',
        faded && 'opacity-60',
      )}
    >
      <div className="w-10 h-10 rounded-xl bg-lavender-100 grid place-items-center text-lavender-500 flex-shrink-0">
        {event.recurrence ? (
          <Repeat className="w-5 h-5" />
        ) : (
          <Calendar className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium text-ink-900 truncate">{event.title}</div>
          {event.recurrence && (
            <span className="pill bg-lavender-100 text-lavender-500 text-[10px] uppercase tracking-wider">
              {event.recurrence.frequency === 'yearly' ? 'Yearly' : 'Monthly'}
            </span>
          )}
        </div>
        <div className="text-xs text-ink-500 mt-0.5">
          {event.recurrence
            ? `${event.recurrence.frequency === 'yearly'
                ? start.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
                : `Day ${start.getDate()} of each month`}`
            : `${formatLongDate(localDateFromISO(event.start))} · ${time}`}
          {event.source === 'google' && (
            <span className="ml-2 pill bg-sand-100 text-ink-500">Google</span>
          )}
        </div>
        {event.notes && (
          <div className="text-xs text-ink-500 mt-1 italic truncate">
            {event.notes}
          </div>
        )}
      </div>
      <button
        onClick={onEdit}
        className="p-2 rounded-md text-ink-400 hover:text-ink-700 hover:bg-sand-200"
        title="Edit"
      >
        <Pencil className="w-4 h-4" />
      </button>
      <button
        onClick={onDelete}
        className="p-2 rounded-md text-ink-400 hover:text-rose-500 hover:bg-rose-100"
        title="Delete"
      >
        <Trash className="w-4 h-4" />
      </button>
    </div>
  );
}

function EventForm({
  mode,
  initial,
  onCancel,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  initial?: CalendarEvent;
  onCancel: () => void;
  onSubmit: (payload: Omit<CalendarEvent, 'id'>) => void;
}) {
  const initialStart = initial ? new Date(initial.start) : null;
  const initialEnd = initial ? new Date(initial.end) : null;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [date, setDate] = useState(
    initial ? localDateFromISO(initial.start) : todayISO(),
  );
  const [startTime, setStartTime] = useState(
    initialStart
      ? `${pad(initialStart.getHours())}:${pad(initialStart.getMinutes())}`
      : '09:00',
  );
  const [endTime, setEndTime] = useState(
    initialEnd
      ? `${pad(initialEnd.getHours())}:${pad(initialEnd.getMinutes())}`
      : '10:00',
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [repeats, setRepeats] = useState<'none' | EventRecurrenceFrequency>(
    initial?.recurrence?.frequency ?? 'none',
  );

  const submit = () => {
    if (!title.trim()) return;
    // Recurring birthdays/anniversaries don't carry a meaningful time range;
    // store them as a 15-min marker at 09:00 anchored on the chosen date.
    const effectiveStart = repeats === 'none' ? startTime : '09:00';
    const effectiveEnd = repeats === 'none' ? endTime : '09:15';
    const start = new Date(`${date}T${effectiveStart}:00`);
    const end = new Date(`${date}T${effectiveEnd}:00`);
    if (end <= start) {
      end.setTime(start.getTime() + 30 * 60000);
    }
    onSubmit({
      title: title.trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      notes: notes.trim() || undefined,
      source: initial?.source ?? 'mock',
      recurrence: repeats === 'none' ? undefined : { frequency: repeats },
    });
  };

  return (
    <div className="card p-4 border-lavender-300 bg-lavender-100/50 relative">
      <button
        onClick={onCancel}
        className="absolute right-3 top-3 p-1 rounded-md text-ink-400 hover:bg-sand-200"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="font-medium text-ink-900 mb-3">
        {mode === 'create' ? 'New event' : 'Edit event'}
      </div>
      <div className="space-y-3">
        <div>
          <label className="label">Title</label>
          <input
            autoFocus
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Dentist"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">
              {repeats === 'none' ? 'Date' : 'Anchor date'}
            </label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {repeats !== 'none' && (
              <div className="text-[11px] text-ink-400 mt-1">
                {repeats === 'yearly'
                  ? 'Repeats every year on this month and day.'
                  : 'Repeats every month on this day.'}
              </div>
            )}
          </div>
          <div>
            <label className="label">Repeats</label>
            <select
              className="input"
              value={repeats}
              onChange={(e) =>
                setRepeats(e.target.value as 'none' | EventRecurrenceFrequency)
              }
            >
              <option value="none">One-time event</option>
              <option value="yearly">Yearly (birthday, anniversary)</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {repeats === 'none' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start</label>
              <input
                type="time"
                className="input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="label">End</label>
              <input
                type="time"
                className="input"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        )}
        <div>
          <label className="label">Notes (optional)</label>
          <textarea
            className="input min-h-[60px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="btn-primary"
          >
            {mode === 'create' ? 'Add event' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const arr = Array.isArray(children) ? children : [children];
  const has = arr.filter(Boolean).length > 0;
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-ink-400 font-semibold mb-2">
        {title}
      </div>
      {has ? (
        <div className="space-y-2">{children}</div>
      ) : emptyText ? (
        <div className="text-sm italic text-ink-400">{emptyText}</div>
      ) : null}
    </div>
  );
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
