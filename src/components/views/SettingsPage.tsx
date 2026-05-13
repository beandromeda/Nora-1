import { useState } from 'react';
import { usePlanner } from '../../state/usePlanner';
import { WEEKDAYS_LONG, formatHoursDecimal } from '../../lib/dates';
import { CapacityBar } from '../CapacityBar';
import { AlertTriangle, Heart } from '../icons';

export function SettingsPage() {
  const { settings, updateSettings, resetToSamples } = usePlanner();
  const [confirmReset, setConfirmReset] = useState(false);

  const setWeekday = (idx: number, hours: number) => {
    const next = [...settings.weekdayCapacityMinutes];
    next[idx] = Math.round(hours * 60);
    updateSettings({ weekdayCapacityMinutes: next });
  };

  const setAllWeekdays = (hours: number) => {
    const minutes = Math.round(hours * 60);
    updateSettings({
      defaultDailyCapacityMinutes: minutes,
      weekdayCapacityMinutes: Array(7).fill(minutes),
    });
  };

  const dayOrder =
    settings.weekStartsOn === 1
      ? [1, 2, 3, 4, 5, 6, 0] // Mon..Sun
      : [0, 1, 2, 3, 4, 5, 6]; // Sun..Sat

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <div className="font-display text-3xl text-ink-900">Settings</div>
        <div className="text-sm text-ink-500 mt-1">
          Tune Nora to fit your weeks. Changes save instantly.
        </div>
      </div>

      {/* Average daily capacity */}
      <Section
        title="Average daily capacity"
        description="A baseline for every day. Adjust per-weekday below if some days run lighter."
      >
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={14}
            step={0.5}
            value={settings.defaultDailyCapacityMinutes / 60}
            onChange={(e) => setAllWeekdays(Number(e.target.value))}
            className="flex-1 accent-sage-500"
          />
          <div className="font-display text-3xl text-ink-900 w-20 text-right">
            {formatHoursDecimal(settings.defaultDailyCapacityMinutes)}
            <span className="text-base text-ink-500 ml-1">h</span>
          </div>
        </div>
        <div className="text-xs text-ink-400 mt-2">
          Sliding here resets every weekday to this value. Use the per-weekday
          rows below to fine-tune.
        </div>
      </Section>

      {/* Per-weekday capacity */}
      <Section
        title="Per-weekday capacity"
        description="Quieter Fridays? Zero-effort weekends? Set each day independently."
      >
        <div className="space-y-2">
          {dayOrder.map((idx) => {
            const mins = settings.weekdayCapacityMinutes[idx];
            return (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-20 text-sm text-ink-700 font-medium">
                  {WEEKDAYS_LONG[idx]}
                </div>
                <input
                  type="range"
                  min={0}
                  max={14}
                  step={0.5}
                  value={mins / 60}
                  onChange={(e) => setWeekday(idx, Number(e.target.value))}
                  className="flex-1 accent-sage-500"
                />
                <div className="w-16 text-right text-sm text-ink-700 tabular-nums">
                  {formatHoursDecimal(mins)}h
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Buffer between tasks */}
      <Section
        title="Buffer between tasks"
        description="Reserved minutes per task for transitions, breaks, or breathing room. Counted against your daily capacity."
      >
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={30}
            step={5}
            value={settings.bufferMinutesBetweenTasks}
            onChange={(e) =>
              updateSettings({
                bufferMinutesBetweenTasks: Number(e.target.value),
              })
            }
            className="flex-1 accent-sage-500"
          />
          <div className="font-display text-3xl text-ink-900 w-20 text-right">
            {settings.bufferMinutesBetweenTasks}
            <span className="text-base text-ink-500 ml-1">m</span>
          </div>
        </div>
      </Section>

      {/* Capacity warning threshold */}
      <Section
        title="Capacity warning"
        description="When a day's load passes this share of capacity, the bar shifts to a warmer tone — a nudge before things tip into overload."
      >
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={settings.capacityWarningThreshold}
            onChange={(e) =>
              updateSettings({
                capacityWarningThreshold: Number(e.target.value),
              })
            }
            className="flex-1 accent-sage-500"
          />
          <div className="font-display text-3xl text-ink-900 w-20 text-right">
            {settings.capacityWarningThreshold}
            <span className="text-base text-ink-500 ml-1">%</span>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xs text-ink-400 mb-1.5">Preview</div>
          <CapacityBar
            plannedMinutes={Math.round(
              (settings.capacityWarningThreshold / 100) * 8 * 60,
            )}
            capacityMinutes={8 * 60}
            warnThreshold={settings.capacityWarningThreshold}
          />
        </div>
      </Section>

      {/* Week start */}
      <Section
        title="Week starts on"
        description="Which day anchors the weekly view and the monthly grid."
      >
        <div className="flex gap-2">
          {([0, 1] as const).map((d) => (
            <button
              key={d}
              onClick={() => updateSettings({ weekStartsOn: d })}
              className={
                'px-4 py-2 rounded-xl border text-sm font-medium transition-colors ' +
                (settings.weekStartsOn === d
                  ? 'border-sage-400 bg-sage-50 text-ink-900'
                  : 'border-sand-200 text-ink-500 hover:border-sage-200')
              }
            >
              {d === 0 ? 'Sunday' : 'Monday'}
            </button>
          ))}
        </div>
      </Section>

      {/* Danger zone */}
      <Section
        title="Reset"
        description="Wipes tasks, events, settings, capacity overrides, and completion state. Restores the demo data."
        tone="danger"
      >
        {confirmReset ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-rose-500">
              <AlertTriangle className="w-4 h-4" />
              This can't be undone.
            </div>
            <button
              onClick={() => {
                resetToSamples();
                setConfirmReset(false);
              }}
              className="btn bg-rose-400 text-sand-50 hover:bg-rose-500"
            >
              Yes, reset everything
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="btn-ghost"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="btn-ghost text-rose-500 hover:bg-rose-100"
          >
            <Heart className="w-4 h-4" />
            Reset everything
          </button>
        )}
      </Section>

      <div className="text-center text-xs text-ink-400 py-4">
        Settings live only in this browser.
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
  tone = 'default',
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <div
      className={
        'card p-5 ' +
        (tone === 'danger' ? 'border-rose-200 bg-rose-100/30' : '')
      }
    >
      <div className="font-display text-lg text-ink-900">{title}</div>
      {description && (
        <div className="text-sm text-ink-500 mt-1 mb-4 leading-relaxed">
          {description}
        </div>
      )}
      {children}
    </div>
  );
}
