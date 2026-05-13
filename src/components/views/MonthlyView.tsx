import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

import { usePlanner } from '../../state/usePlanner';
import {
  buildMonthGrid,
  fromISODate,
  formatDuration,
  formatMonthYear,
  startOfMonth,
  todayISO,
  WEEKDAYS_SHORT,
  getMonthIndex,
} from '../../lib/dates';
import { planRange } from '../../lib/planner';
import {
  categoryForBlock,
  useViewFilter,
} from '../../state/useViewFilter';
import { ViewFilterToggle } from './ViewFilterToggle';

export function MonthlyView() {
  const {
    tasks,
    events,
    capacityOverrides,
    manualPlacements,
    completedInstances,
    settings,
    anchorDate,
    setAnchorDate,
    setViewMode,
    monthlyNotes,
    setMonthlyNote,
  } = usePlanner();

  const grid = useMemo(
    () => buildMonthGrid(anchorDate, settings.weekStartsOn),
    [anchorDate, settings.weekStartsOn],
  );

  // Plan across the entire 6x7 grid so events/tasks appear consistently even
  // for the leading/trailing days from neighbouring months.
  const monthPlan = useMemo(
    () =>
      planRange({
        tasks,
        events,
        capacityOverrides,
        manualPlacements,
        completedInstances,
        defaultDailyCapacityMinutes: settings.defaultDailyCapacityMinutes,
        rangeStart: grid[0],
        rangeEnd: grid[grid.length - 1],
      }),
    [
      grid,
      tasks,
      events,
      capacityOverrides,
      manualPlacements,
      completedInstances,
      settings.defaultDailyCapacityMinutes,
    ],
  );

  const dayMap = new Map(monthPlan.days.map((d) => [d.date, d]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const eventById = new Map(events.map((e) => [e.id, e]));
  const currentMonth = getMonthIndex(startOfMonth(anchorDate));
  const today = todayISO();

  const filter = useViewFilter('monthly', ['recurring-monthly']);

  const headerDays =
    settings.weekStartsOn === 1
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : WEEKDAYS_SHORT;

  const drillDown = (date: string) => {
    setAnchorDate(date);
    setViewMode('weekly');
  };

  // Notes box: keyed by "YYYY-MM" so each month has its own pad.
  const monthKey = startOfMonth(anchorDate).slice(0, 7);
  const persistedNote = monthlyNotes[monthKey] ?? '';
  const [noteDraft, setNoteDraft] = useState(persistedNote);
  const [noteSavedFlash, setNoteSavedFlash] = useState(false);
  const noteFlashTimer = useRef<number | null>(null);

  // Reset the draft when the month changes (or when the stored note changes
  // from another surface).
  useEffect(() => {
    setNoteDraft(persistedNote);
  }, [persistedNote]);

  useEffect(() => {
    return () => {
      if (noteFlashTimer.current) window.clearTimeout(noteFlashTimer.current);
    };
  }, []);

  const saveNote = () => {
    if (noteDraft === persistedNote) return;
    setMonthlyNote(monthKey, noteDraft);
    setNoteSavedFlash(true);
    if (noteFlashTimer.current) window.clearTimeout(noteFlashTimer.current);
    noteFlashTimer.current = window.setTimeout(
      () => setNoteSavedFlash(false),
      1600,
    );
  };

  return (
    <div className="p-6">
      {/* Monthly notes — one persistent pad per month */}
      <div className="card p-4 mb-4 border-sage-200 bg-sage-50/30">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-xs uppercase tracking-wider text-ink-400 font-semibold">
            Notes for {formatMonthYear(startOfMonth(anchorDate))}
          </div>
          <div
            className={
              'text-[11px] font-medium text-sage-500 transition-opacity ' +
              (noteSavedFlash ? 'opacity-100' : 'opacity-0')
            }
            aria-live="polite"
          >
            Saved
          </div>
        </div>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={saveNote}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              saveNote();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          rows={3}
          placeholder="Anything to remember this month — themes, goals, reminders…"
          className="input resize-none w-full"
        />
      </div>

      <div className="flex items-baseline justify-between mb-3">
        <div className="font-display text-3xl text-ink-900">
          {formatMonthYear(startOfMonth(anchorDate))}
        </div>
        <div className="text-sm text-ink-500">Click a day to drill in</div>
      </div>

      <div className="mb-3">
        <ViewFilterToggle {...filter} />
      </div>

      <div className="grid grid-cols-7 gap-px bg-sand-200 rounded-2xl overflow-hidden border border-sand-200">
        {headerDays.map((d) => (
          <div
            key={d}
            className="bg-sand-50 px-3 py-2 text-xs uppercase tracking-wider text-ink-500 font-semibold"
          >
            {d}
          </div>
        ))}
        {grid.map((iso) => {
          const day = dayMap.get(iso);
          if (!day) return <div key={iso} className="bg-sand-100" />;
          const visibleBlocks = day.blocks.filter((b) =>
            filter.active.has(categoryForBlock(b, taskById)),
          );
          const planned = visibleBlocks.reduce((s, b) => s + b.minutes, 0);
          const overloaded = planned > day.capacityMinutes;
          const fillPct =
            day.capacityMinutes === 0
              ? 0
              : Math.min(100, (planned / day.capacityMinutes) * 100);
          const inMonth = fromISODate(iso).getMonth() === currentMonth;
          const isToday = iso === today;

          // Show up to 3 items
          const previewBlocks = visibleBlocks.slice(0, 3);
          const overflow = visibleBlocks.length - previewBlocks.length;

          return (
            <button
              key={iso}
              onClick={() => drillDown(iso)}
              className={clsx(
                'group bg-sand-100 text-left p-2 min-h-[110px] flex flex-col gap-1 transition-colors',
                !inMonth && 'bg-sand-50 text-ink-300',
                inMonth && 'hover:bg-sand-200',
                overloaded && inMonth && 'bg-rose-100/40',
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={clsx(
                    'inline-flex items-center justify-center w-7 h-7 text-sm rounded-full',
                    isToday
                      ? 'bg-sage-500 text-sand-50 font-semibold'
                      : inMonth
                        ? 'text-ink-900 font-medium'
                        : 'text-ink-300',
                  )}
                >
                  {fromISODate(iso).getDate()}
                </span>
                {inMonth && (
                  <span
                    className={clsx(
                      'text-[10px] font-medium',
                      overloaded ? 'text-rose-500' : 'text-ink-400',
                    )}
                  >
                    {formatDuration(planned)}
                  </span>
                )}
              </div>
              {inMonth && (
                <div className="h-1 rounded-full bg-sand-100 overflow-hidden">
                  <div
                    className={clsx(
                      'h-full',
                      overloaded ? 'bg-rose-400' : 'bg-sage-400',
                    )}
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              )}
              <div className="flex flex-col gap-1 mt-1">
                {previewBlocks.map((b) => {
                  const isEvent = b.kind === 'event';
                  const label = isEvent
                    ? eventById.get(b.eventId!)?.title
                    : taskById.get(b.taskId!)?.name;
                  return (
                    <div
                      key={b.id}
                      className={clsx(
                        'truncate text-[11px] px-1.5 py-0.5 rounded-md',
                        isEvent
                          ? 'bg-lavender-100 text-lavender-500'
                          : taskById.get(b.taskId!)?.priority === 'non-negotiable'
                            ? 'bg-clay-100 text-clay-400'
                            : 'bg-sky-100 text-sky-500',
                      )}
                    >
                      {label}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <div className="text-[10px] text-ink-400 px-1">
                    +{overflow} more
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
