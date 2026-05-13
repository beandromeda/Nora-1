import { useState } from 'react';
import { usePlanner } from '../state/usePlanner';
import { formatLongDate } from '../lib/dates';
import { Heart, X } from './icons';

interface Props {
  date: string | null;
  onClose: () => void;
}

const PRESETS = [
  { label: 'Light day', mins: 4 * 60, mood: 'A gentle pace today' },
  { label: 'Steady', mins: 6 * 60, mood: 'A steady, calm day' },
  { label: 'Default', mins: 9 * 60, mood: 'My usual capacity' },
  { label: 'Big day', mins: 11 * 60, mood: 'I have extra room today' },
];

export function CapacityModal({ date, onClose }: Props) {
  const {
    capacityOverrides,
    setCapacityOverride,
    clearCapacityOverride,
    settings,
  } = usePlanner();

  const existing = capacityOverrides.find((o) => o.date === date);
  const [hours, setHours] = useState<number>(
    existing
      ? existing.minutes / 60
      : settings.defaultDailyCapacityMinutes / 60,
  );
  const [note, setNote] = useState<string>(existing?.note ?? '');

  if (!date) return null;

  const apply = () => {
    setCapacityOverride(date, Math.round(hours * 60), note);
    onClose();
  };

  const reset = () => {
    clearCapacityOverride(date);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/30 backdrop-blur-sm">
      <div className="card w-[440px] max-w-[92vw] p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 p-1.5 rounded-md text-ink-400 hover:bg-sand-200"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 grid place-items-center text-rose-400">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display text-xl text-ink-900">
              How are you today?
            </div>
            <div className="text-sm text-ink-500 mt-0.5">
              {formatLongDate(date)}
            </div>
          </div>
        </div>

        <p className="text-sm text-ink-500 mt-4 leading-relaxed">
          Set a capacity that matches what you actually have today. Your
          non-negotiable items will stay in place. I'll move the flexible ones
          to other days where there's room.
        </p>

        <div className="mt-5">
          <div className="grid grid-cols-2 gap-2 mb-4">
            {PRESETS.map((p) => (
              <button
                key={p.mins}
                onClick={() => setHours(p.mins / 60)}
                className={
                  'text-left p-3 rounded-xl border transition-colors ' +
                  (Math.round(hours * 60) === p.mins
                    ? 'border-sage-400 bg-sage-50'
                    : 'border-sand-200 hover:border-sage-200')
                }
              >
                <div className="font-medium text-ink-900 text-sm">
                  {p.label}
                </div>
                <div className="text-xs text-ink-500 mt-0.5">
                  {p.mins / 60} hours
                </div>
              </button>
            ))}
          </div>

          <label className="label">Custom hours</label>
          <input
            type="range"
            min={1}
            max={14}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-full accent-sage-500"
          />
          <div className="text-center font-display text-3xl text-ink-900 mt-2">
            {hours} <span className="text-base text-ink-500">hours</span>
          </div>

          <label className="label mt-4">Note (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input"
            placeholder="A word about how you're feeling"
          />
        </div>

        <div className="flex justify-between items-center mt-6">
          {existing ? (
            <button
              onClick={reset}
              className="text-sm text-ink-500 hover:text-rose-500"
            >
              Reset to default
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button onClick={apply} className="btn-primary">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
