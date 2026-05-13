import { useState } from 'react';
import clsx from 'clsx';

/**
 * Compact duration input with a min/hr unit toggle.  The model is always
 * stored as minutes; the toggle just controls how the user types it.
 */
export function DurationField({
  minutes,
  onChange,
  className,
  inputClassName,
}: {
  minutes: number;
  onChange: (mins: number) => void;
  className?: string;
  inputClassName?: string;
}) {
  // Default to hours when the value is a clean half-hour multiple ≥ 1 hour.
  const initialUnit: 'min' | 'hr' =
    minutes >= 60 && minutes % 30 === 0 ? 'hr' : 'min';
  const [unit, setUnit] = useState<'min' | 'hr'>(initialUnit);
  const display = unit === 'hr' ? minutes / 60 : minutes;
  return (
    <div className={clsx('flex items-center gap-1 min-w-0', className)}>
      <input
        type="number"
        min={unit === 'hr' ? 0.25 : 5}
        step={unit === 'hr' ? 0.25 : 5}
        className={clsx('input flex-1 min-w-0', inputClassName)}
        value={display}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n) || n <= 0) return;
          const mins = unit === 'hr' ? Math.round(n * 60) : Math.round(n);
          onChange(Math.max(5, mins));
        }}
      />
      <select
        className="input w-[60px] px-1 text-xs flex-shrink-0"
        value={unit}
        onChange={(e) => setUnit(e.target.value as 'min' | 'hr')}
        aria-label="Duration unit"
      >
        <option value="min">min</option>
        <option value="hr">hr</option>
      </select>
    </div>
  );
}
