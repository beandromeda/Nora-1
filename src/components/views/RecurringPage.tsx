import { useMemo, useState } from 'react';
import clsx from 'clsx';

import { usePlanner } from '../../state/usePlanner';
import { WEEKDAYS_LONG } from '../../lib/dates';
import type {
  Priority,
  RecurrenceFrequency,
  Task,
} from '../../types';
import { Lock, Plus, Repeat, Trash, X } from '../icons';
import { DurationField } from '../DurationField';

const FREQ_OPTIONS: RecurrenceFrequency[] = [
  'daily',
  'weekdays',
  'weekends',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
];


export function RecurringPage() {
  const { tasks, updateTask, deleteTask, addTask } = usePlanner();
  const [showForm, setShowForm] = useState(false);

  const recurring = useMemo(
    () =>
      tasks
        .filter((t) => t.kind === 'recurring')
        .sort((a, b) => freqOrder(a) - freqOrder(b) || a.name.localeCompare(b.name)),
    [tasks],
  );

  const grouped: Record<RecurrenceFrequency, Task[]> = {
    daily: [],
    weekdays: [],
    weekends: [],
    weekly: [],
    biweekly: [],
    monthly: [],
    quarterly: [],
  };
  for (const t of recurring) {
    const f = t.recurrence?.frequency ?? 'weekly';
    grouped[f].push(t);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="font-display text-3xl text-ink-900">
            Recurring tasks
          </div>
          <div className="text-sm text-ink-500 mt-1">
            Everything that happens on a rhythm — edit once, applies everywhere.
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'Close' : 'Add recurring'}
        </button>
      </div>

      {showForm && (
        <NewRecurringForm
          onCancel={() => setShowForm(false)}
          onCreate={(t) => {
            addTask(t);
            setShowForm(false);
          }}
        />
      )}

      {recurring.length === 0 && !showForm ? (
        <div className="card p-10 text-center">
          <div className="font-display text-xl text-ink-900">
            No recurring tasks yet
          </div>
          <div className="text-sm text-ink-500 mt-1">
            Add the rhythms of your week — chores, workouts, weekly reviews.
          </div>
        </div>
      ) : (
        FREQ_OPTIONS.map((freq) =>
          grouped[freq].length === 0 ? null : (
            <div key={freq}>
              <div className="text-xs uppercase tracking-wider text-ink-400 font-semibold mb-2">
                {labelFor(freq)} · {grouped[freq].length}
              </div>
              <div className="space-y-2">
                {grouped[freq].map((t) => (
                  <RecurringRow
                    key={t.id}
                    task={t}
                    onChange={(patch) => updateTask(t.id, patch)}
                    onDelete={() => deleteTask(t.id)}
                  />
                ))}
              </div>
            </div>
          ),
        )
      )}
    </div>
  );
}

function RecurringRow({
  task,
  onChange,
  onDelete,
}: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
  onDelete: () => void;
}) {
  const freq = task.recurrence?.frequency ?? 'weekly';
  // Show a day-of-week picker only when the user picks a specific weekday
  // (weekly / biweekly).  Daily, weekdays, weekends don't need one.
  const needsDayOfWeek = freq === 'weekly' || freq === 'biweekly';
  const isMonthly = freq === 'monthly' || freq === 'quarterly';

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            'w-9 h-9 rounded-xl grid place-items-center flex-shrink-0',
            task.priority === 'non-negotiable'
              ? 'bg-clay-100 text-clay-400'
              : 'bg-sand-100 text-ink-500',
          )}
        >
          {task.priority === 'non-negotiable' ? (
            <Lock className="w-4 h-4" />
          ) : (
            <Repeat className="w-4 h-4" />
          )}
        </div>

        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
          <input
            className="input md:col-span-4"
            value={task.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
          <DurationField
            className="md:col-span-2"
            minutes={task.estimatedMinutes}
            onChange={(mins) => onChange({ estimatedMinutes: mins })}
          />
          <select
            className="input md:col-span-2"
            value={freq}
            onChange={(e) => {
              const next = e.target.value as RecurrenceFrequency;
              onChange({
                recurrence: {
                  ...(task.recurrence ?? {}),
                  frequency: next,
                },
              });
            }}
          >
            {FREQ_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {labelFor(f)}
              </option>
            ))}
          </select>
          {needsDayOfWeek ? (
            <select
              className="input md:col-span-2"
              value={task.recurrence?.dayOfWeek ?? 0}
              onChange={(e) =>
                onChange({
                  recurrence: {
                    ...(task.recurrence ?? { frequency: freq }),
                    dayOfWeek: Number(e.target.value),
                  },
                  preferredDayOfWeek: Number(e.target.value),
                })
              }
            >
              {WEEKDAYS_LONG.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          ) : isMonthly ? (
            <input
              type="number"
              min={1}
              max={28}
              className="input md:col-span-2"
              value={task.recurrence?.dayOfMonth ?? 1}
              onChange={(e) =>
                onChange({
                  recurrence: {
                    ...(task.recurrence ?? { frequency: freq }),
                    dayOfMonth: Math.min(
                      28,
                      Math.max(1, Number(e.target.value) || 1),
                    ),
                  },
                })
              }
            />
          ) : (
            <div className="md:col-span-2" />
          )}
          <select
            className="input md:col-span-2"
            value={task.priority}
            onChange={(e) =>
              onChange({ priority: e.target.value as Priority })
            }
          >
            <option value="negotiable">Negotiable</option>
            <option value="non-negotiable">Non-negotiable</option>
          </select>
        </div>

        <button
          onClick={onDelete}
          className="p-2 rounded-md text-ink-400 hover:text-rose-500 hover:bg-rose-100 flex-shrink-0"
          title="Delete recurring task"
        >
          <Trash className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-2 ml-12 flex items-center gap-3 text-xs">
        <label className="inline-flex items-center gap-1.5 text-ink-500">
          <input
            type="checkbox"
            className="accent-sage-500"
            checked={task.splittable}
            onChange={(e) => onChange({ splittable: e.target.checked })}
          />
          Splittable
        </label>
        {task.splittable && (
          <div className="inline-flex items-center gap-1.5 text-ink-500">
            <span>min block</span>
            <input
              type="number"
              min={5}
              step={5}
              className="input w-20 py-1"
              value={task.minBlockMinutes ?? 15}
              onChange={(e) =>
                onChange({
                  minBlockMinutes: Math.max(5, Number(e.target.value) || 15),
                })
              }
            />
            <span>min</span>
          </div>
        )}
      </div>
    </div>
  );
}

function NewRecurringForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (t: Omit<Task, 'id' | 'createdAt'>) => void;
}) {
  const [name, setName] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [priority, setPriority] = useState<Priority>('negotiable');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [splittable, setSplittable] = useState(false);

  const needsDayOfWeek = frequency === 'weekly' || frequency === 'biweekly';
  const needsDayOfMonth = frequency === 'monthly' || frequency === 'quarterly';

  const submit = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      estimatedMinutes: Math.max(5, estimatedMinutes),
      priority,
      kind: 'recurring',
      recurrence: {
        frequency,
        dayOfWeek: needsDayOfWeek ? dayOfWeek : undefined,
        dayOfMonth: needsDayOfMonth ? dayOfMonth : undefined,
      },
      preferredDayOfWeek: needsDayOfWeek ? dayOfWeek : undefined,
      splittable,
    });
  };

  return (
    <div className="card p-4 border-sage-200 bg-sage-50/50 relative">
      <button
        onClick={onCancel}
        className="absolute right-3 top-3 p-1 rounded-md text-ink-400 hover:bg-sand-200"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="font-medium text-ink-900 mb-3">New recurring task</div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
        <input
          autoFocus
          className="input md:col-span-4"
          placeholder="Task name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <DurationField
          className="md:col-span-2"
          minutes={estimatedMinutes}
          onChange={setEstimatedMinutes}
        />
        <select
          className="input md:col-span-2"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
        >
          {FREQ_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {labelFor(f)}
            </option>
          ))}
        </select>
        {needsDayOfWeek ? (
          <select
            className="input md:col-span-2"
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
          >
            {WEEKDAYS_LONG.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        ) : needsDayOfMonth ? (
          <input
            type="number"
            min={1}
            max={28}
            className="input md:col-span-2"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(Number(e.target.value))}
          />
        ) : (
          <div className="md:col-span-2" />
        )}
        <select
          className="input md:col-span-2"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
        >
          <option value="negotiable">Negotiable</option>
          <option value="non-negotiable">Non-negotiable</option>
        </select>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="inline-flex items-center gap-1.5 text-xs text-ink-500">
          <input
            type="checkbox"
            className="accent-sage-500"
            checked={splittable}
            onChange={(e) => setSplittable(e.target.checked)}
          />
          Splittable
        </label>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="btn-primary"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function labelFor(f: RecurrenceFrequency): string {
  switch (f) {
    case 'daily':
      return 'Daily';
    case 'weekdays':
      return 'Weekdays (Mon–Fri)';
    case 'weekends':
      return 'Weekends (Sat–Sun)';
    case 'weekly':
      return 'Weekly';
    case 'biweekly':
      return 'Biweekly';
    case 'monthly':
      return 'Monthly';
    case 'quarterly':
      return 'Quarterly';
  }
}

function freqOrder(t: Task): number {
  const order: Record<RecurrenceFrequency, number> = {
    daily: 0,
    weekdays: 1,
    weekends: 2,
    weekly: 3,
    biweekly: 4,
    monthly: 5,
    quarterly: 6,
  };
  return order[t.recurrence?.frequency ?? 'weekly'];
}
