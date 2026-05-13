import { useState } from 'react';
import clsx from 'clsx';

import { usePlanner } from '../../state/usePlanner';
import type { Habit } from '../../types';
import { Heart, Plus, Trash, X } from '../icons';

const COLOR_OPTIONS: { id: NonNullable<Habit['color']>; swatch: string; label: string }[] = [
  { id: 'lavender', swatch: 'bg-lavender-500', label: 'Lavender' },
  { id: 'sage',     swatch: 'bg-sage-500',     label: 'Sage' },
  { id: 'sky',      swatch: 'bg-sky-500',      label: 'Sky' },
  { id: 'clay',     swatch: 'bg-clay-400',     label: 'Peach' },
  { id: 'rose',     swatch: 'bg-rose-400',     label: 'Coral' },
];

const ICON_SUGGESTIONS = ['💧', '🧘', '🚶', '📚', '🍎', '💤', '🏋️', '✍️', '☕', '🌱', '🧠', '✨'];

export function HabitsPage() {
  const { habits, addHabit, updateHabit, deleteHabit } = usePlanner();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="font-display text-3xl text-ink-900">Habits</div>
          <div className="text-sm text-ink-500 mt-1">
            Daily check-offs that build streaks. Add the rhythms you're trying to grow.
          </div>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus className="w-4 h-4" />
          {showForm ? 'Close' : 'Add habit'}
        </button>
      </div>

      {showForm && (
        <NewHabitForm
          onCancel={() => setShowForm(false)}
          onCreate={(h) => {
            addHabit(h);
            setShowForm(false);
          }}
        />
      )}

      {habits.length === 0 && !showForm ? (
        <div className="card p-10 text-center">
          <Heart className="w-6 h-6 mx-auto mb-2 text-lavender-400" />
          <div className="font-display text-xl text-ink-900">
            No habits yet
          </div>
          <div className="text-sm text-ink-500 mt-1 max-w-md mx-auto">
            Try starting with one or two — "drink water" or "10-minute walk." You'll see
            streaks build over time on the Daily and Analytics tabs.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {habits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              onChange={(patch) => updateHabit(habit.id, patch)}
              onDelete={() => deleteHabit(habit.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HabitRow({
  habit,
  onChange,
  onDelete,
}: {
  habit: Habit;
  onChange: (patch: Partial<Habit>) => void;
  onDelete: () => void;
}) {
  const color = habit.color ?? 'lavender';
  const swatch = COLOR_OPTIONS.find((c) => c.id === color)?.swatch ?? 'bg-lavender-500';

  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={clsx('w-10 h-10 rounded-xl grid place-items-center text-base flex-shrink-0', swatch, 'text-sand-50')}>
        {habit.icon ?? '✦'}
      </div>
      <input
        className="input flex-1"
        value={habit.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <input
        className="input w-32"
        placeholder="Category"
        value={habit.category ?? ''}
        onChange={(e) => onChange({ category: e.target.value || undefined })}
      />
      <input
        className="input w-16 text-center"
        placeholder="✦"
        value={habit.icon ?? ''}
        maxLength={2}
        onChange={(e) => onChange({ icon: e.target.value || undefined })}
      />
      <select
        className="input w-32"
        value={color}
        onChange={(e) => onChange({ color: e.target.value as Habit['color'] })}
      >
        {COLOR_OPTIONS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <button
        onClick={onDelete}
        className="p-2 rounded-md text-ink-400 hover:text-rose-400 hover:bg-sand-200 flex-shrink-0"
        title="Delete habit"
      >
        <Trash className="w-4 h-4" />
      </button>
    </div>
  );
}

function NewHabitForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (h: Omit<Habit, 'id' | 'createdAt'>) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [icon, setIcon] = useState('💧');
  const [color, setColor] = useState<Habit['color']>('lavender');

  const submit = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      category: category.trim() || undefined,
      icon: icon || undefined,
      color,
    });
  };

  return (
    <div className="card p-5 border-lavender-300 bg-lavender-200/20 relative">
      <button
        onClick={onCancel}
        className="absolute right-3 top-3 p-1 rounded-md text-ink-400 hover:bg-sand-200"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="font-medium text-ink-900 mb-3">New habit</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Name</label>
          <input
            autoFocus
            className="input"
            placeholder="Drink water, meditate, evening walk…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Category (optional)</label>
          <input
            className="input"
            placeholder="Health, Mind, Work…"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Icon</label>
          <div className="flex flex-wrap gap-1.5">
            {ICON_SUGGESTIONS.map((sug) => (
              <button
                key={sug}
                onClick={() => setIcon(sug)}
                className={clsx(
                  'w-8 h-8 rounded-lg grid place-items-center transition-colors text-base',
                  icon === sug
                    ? 'bg-lavender-500 text-sand-50'
                    : 'bg-sand-50 hover:bg-sand-200',
                )}
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Color</label>
          <div className="flex gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.id}
                onClick={() => setColor(c.id)}
                className={clsx(
                  'w-8 h-8 rounded-full transition-all',
                  c.swatch,
                  color === c.id ? 'ring-2 ring-offset-2 ring-offset-sand-100 ring-lavender-400 scale-110' : 'opacity-70 hover:opacity-100',
                )}
                title={c.label}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
        <button onClick={submit} disabled={!name.trim()} className="btn-primary">
          Add habit
        </button>
      </div>
    </div>
  );
}
