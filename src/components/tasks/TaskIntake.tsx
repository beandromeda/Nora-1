import { useState } from 'react';
import clsx from 'clsx';
import { usePlanner } from '../../state/usePlanner';
import { parseTaskInput, type ParsedTask } from '../../lib/nlp';
import type { Priority, RecurrenceFrequency, Task } from '../../types';
import { DurationField } from '../DurationField';
import { Plus, Send, Sparkles, X } from '../icons';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'chat' | 'form';

export function TaskIntake({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('chat');

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-[560px] max-w-[92vw] p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 p-1.5 rounded-md text-ink-400 hover:bg-sand-200"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-sage-50 grid place-items-center text-sage-600">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display text-xl text-ink-900">
              Add to your plan
            </div>
            <div className="text-sm text-ink-500">
              Type naturally, or fill in the fields
            </div>
          </div>
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-sand-100 border border-sand-200 w-fit mb-4">
          {(['chat', 'form'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                tab === t
                  ? 'bg-sand-100 text-ink-900 shadow-soft'
                  : 'text-ink-500 hover:text-ink-700',
              )}
            >
              {t === 'chat' ? 'Quick add' : 'Detailed'}
            </button>
          ))}
        </div>

        {tab === 'chat' ? (
          <ChatIntake onClose={onClose} />
        ) : (
          <FormIntake onClose={onClose} />
        )}
      </div>
    </div>
  );
}

// ---------- Chat-style intake ----------

function ChatIntake({ onClose }: { onClose: () => void }) {
  const { addTask } = usePlanner();
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedTask | null>(null);
  const [estimate, setEstimate] = useState<string>('');
  const [priority, setPriority] = useState<Priority>('negotiable');

  const onParse = () => {
    if (!text.trim()) return;
    const p = parseTaskInput(text);
    setParsed(p);
    if (p.estimatedMinutes) setEstimate(String(p.estimatedMinutes));
    if (p.priority) setPriority(p.priority);
  };

  const commit = () => {
    if (!parsed) return;
    const minutes = Number(estimate) || parsed.estimatedMinutes || 30;
    const task: Omit<Task, 'id' | 'createdAt'> = {
      name: parsed.name,
      estimatedMinutes: minutes,
      priority,
      kind: parsed.recurrence ? 'recurring' : 'one-time',
      recurrence: parsed.recurrence
        ? {
            frequency: parsed.recurrence,
            dayOfWeek: parsed.preferredDayOfWeek,
          }
        : undefined,
      preferredDayOfWeek: parsed.preferredDayOfWeek,
      preferredDate: parsed.preferredDate,
      deadline: parsed.deadline,
      splittable: parsed.splittable ?? false,
      notes: parsed.notes,
    };
    addTask(task);
    setText('');
    setParsed(null);
    onClose();
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onParse()}
          className="input"
          placeholder='Try "Clean the garage sometime this month, 4 hours, can be split"'
        />
        <button onClick={onParse} className="btn-primary" disabled={!text.trim()}>
          <Send className="w-4 h-4" />
        </button>
      </div>

      {parsed && (
        <div className="mt-4 p-4 rounded-xl bg-sand-50 border border-sand-200">
          <div className="flex items-center gap-2 text-sm text-ink-500 mb-3">
            <Sparkles className="w-4 h-4 text-sage-500" />
            Here's what I picked up — fix anything before I add it.
          </div>

          <div className="space-y-3">
            <Row label="Task">
              <div className="font-medium text-ink-900">{parsed.name}</div>
            </Row>

            <Row label="Duration">
              <DurationField
                className="w-40"
                minutes={Math.max(5, Number(estimate) || 30)}
                onChange={(mins) => setEstimate(String(mins))}
              />
            </Row>

            <Row label="Priority">
              <div className="flex gap-2">
                {(
                  [
                    ['non-negotiable', 'Non-negotiable'],
                    ['negotiable', 'Negotiable'],
                  ] as [Priority, string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setPriority(val)}
                    className={clsx(
                      'pill cursor-pointer transition-colors',
                      priority === val
                        ? val === 'non-negotiable'
                          ? 'bg-clay-100 text-clay-400 ring-1 ring-clay-200'
                          : 'bg-sage-50 text-sage-700 ring-1 ring-sage-200'
                        : 'bg-sand-100 text-ink-500 hover:bg-sand-200',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Row>

            {parsed.recurrence && (
              <Row label="Recurrence">
                <span className="pill bg-sand-100 text-ink-700">
                  {parsed.recurrence}
                </span>
              </Row>
            )}
            {parsed.deadline && (
              <Row label="Deadline">
                <span className="pill bg-rose-100 text-rose-500">
                  {parsed.deadline}
                </span>
              </Row>
            )}
            {parsed.splittable && (
              <Row label="Splittable">
                <span className="pill bg-sage-50 text-sage-700">Yes</span>
              </Row>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setParsed(null)} className="btn-ghost">
              Edit text
            </button>
            <button
              onClick={commit}
              disabled={!estimate}
              className="btn-primary"
            >
              Add task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Detailed form ----------

function FormIntake({ onClose }: { onClose: () => void }) {
  const { addTask } = usePlanner();
  const [name, setName] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [priority, setPriority] = useState<Priority>('negotiable');
  const [kind, setKind] = useState<'one-time' | 'recurring'>('one-time');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState<number>(0);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [preferredDate, setPreferredDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [splittable, setSplittable] = useState(false);
  const [notes, setNotes] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    const needsDayOfWeek =
      frequency === 'weekly' || frequency === 'biweekly';
    const needsDayOfMonth =
      frequency === 'monthly' || frequency === 'quarterly';
    const t: Omit<Task, 'id' | 'createdAt'> = {
      name: name.trim(),
      estimatedMinutes: Math.max(5, estimatedMinutes),
      priority,
      kind,
      recurrence:
        kind === 'recurring'
          ? {
              frequency,
              dayOfWeek: needsDayOfWeek ? dayOfWeek : undefined,
              dayOfMonth: needsDayOfMonth ? dayOfMonth : undefined,
            }
          : undefined,
      preferredDayOfWeek:
        kind === 'recurring' && needsDayOfWeek ? dayOfWeek : undefined,
      preferredDate: kind === 'one-time' ? preferredDate || undefined : undefined,
      deadline: deadline || undefined,
      splittable,
      notes: notes || undefined,
    };
    addTask(t);
    onClose();
  };

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <div>
        <label className="label">Task name</label>
        <input
          autoFocus
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Quarterly closet cleanup"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Estimated duration</label>
          <DurationField
            minutes={estimatedMinutes}
            onChange={setEstimatedMinutes}
          />
        </div>
        <div>
          <label className="label">Priority</label>
          <select
            className="input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            <option value="negotiable">Negotiable</option>
            <option value="non-negotiable">Non-negotiable</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Type</label>
          <select
            className="input"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'one-time' | 'recurring')}
          >
            <option value="one-time">One-time</option>
            <option value="recurring">Recurring</option>
          </select>
        </div>
        <div>
          <label className="label">Splittable</label>
          <select
            className="input"
            value={splittable ? 'yes' : 'no'}
            onChange={(e) => setSplittable(e.target.value === 'yes')}
          >
            <option value="no">No — one block</option>
            <option value="yes">Yes — can be split</option>
          </select>
        </div>
      </div>

      {kind === 'recurring' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Frequency</label>
            <select
              className="input"
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as RecurrenceFrequency)
              }
            >
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays (Mon–Fri)</option>
              <option value="weekends">Weekends (Sat–Sun)</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
          {frequency === 'weekly' || frequency === 'biweekly' ? (
            <div>
              <label className="label">Preferred day</label>
              <select
                className="input"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
              >
                {[
                  'Sunday',
                  'Monday',
                  'Tuesday',
                  'Wednesday',
                  'Thursday',
                  'Friday',
                  'Saturday',
                ].map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            (frequency === 'monthly' || frequency === 'quarterly') && (
              <div>
                <label className="label">Day of month</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={28}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                />
              </div>
            )
          )}
        </div>
      )}

      {kind === 'one-time' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Preferred date</label>
            <input
              className="input"
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Deadline</label>
            <input
              className="input"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>
      )}

      <div>
        <label className="label">Notes</label>
        <textarea
          className="input min-h-[64px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="btn-ghost">
          Cancel
        </button>
        <button onClick={submit} className="btn-primary" disabled={!name.trim()}>
          Add task
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3">
      <div className="text-xs uppercase tracking-wide text-ink-400 font-semibold">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
