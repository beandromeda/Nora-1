import clsx from 'clsx';
import { formatHoursDecimal } from '../lib/dates';

interface Props {
  plannedMinutes: number;
  capacityMinutes: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  /** Percentage (0..100) at which the bar shifts to a warning tone. */
  warnThreshold?: number;
}

export function CapacityBar({
  plannedMinutes,
  capacityMinutes,
  showLabel = true,
  size = 'md',
  warnThreshold = 100,
}: Props) {
  const pct = capacityMinutes === 0 ? 0 : (plannedMinutes / capacityMinutes) * 100;
  const overloaded = pct > 100;
  const warning = !overloaded && pct >= warnThreshold;
  const filled = Math.min(100, pct);
  const overflow = Math.min(40, Math.max(0, pct - 100));

  const trackHeight = size === 'sm' ? 'h-1.5' : 'h-2';

  const fillTone = overloaded
    ? 'bg-rose-300'
    : warning
      ? 'bg-clay-300'
      : 'bg-sage-400';

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1 text-xs text-ink-500">
          <span>
            <span
              className={clsx(
                'font-semibold',
                overloaded
                  ? 'text-rose-500'
                  : warning
                    ? 'text-clay-400'
                    : 'text-ink-700',
              )}
            >
              {formatHoursDecimal(plannedMinutes)}h
            </span>
            <span className="mx-1">/</span>
            <span>{formatHoursDecimal(capacityMinutes)}h</span>
          </span>
          {overloaded && (
            <span className="text-rose-500 font-medium">
              +{formatHoursDecimal(plannedMinutes - capacityMinutes)}h over
            </span>
          )}
        </div>
      )}
      <div
        className={clsx(
          'w-full rounded-full bg-sand-100 overflow-hidden relative',
          trackHeight,
        )}
      >
        <div
          className={clsx('h-full rounded-full transition-all', fillTone)}
          style={{ width: `${filled}%` }}
        />
        {overloaded && (
          <div
            className="absolute top-0 right-0 h-full bg-rose-400/80 rounded-r-full"
            style={{ width: `${overflow}%` }}
          />
        )}
      </div>
    </div>
  );
}
