import { useMemo } from 'react';
import clsx from 'clsx';

import { usePlanner } from '../../state/usePlanner';
import {
  addDays,
  endOfMonth,
  formatMonthYear,
  fromISODate,
  localDateFromISO,
  startOfMonth,
  startOfQuarter,
  todayISO,
  MONTH_NAMES,
} from '../../lib/dates';
import { allInstancesInRange } from '../../lib/recurrence';
import { planRange } from '../../lib/planner';
import {
  categoryForBlock,
  categoryForTask,
  useViewFilter,
} from '../../state/useViewFilter';
import { ViewFilterToggle } from './ViewFilterToggle';
import type { DayPlan, ScheduledBlock } from '../../types';

export function QuarterlyView() {
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
  } = usePlanner();

  const quarter = useMemo(() => {
    const start = startOfQuarter(anchorDate);
    const months = [0, 1, 2].map((offset) => {
      const monthStart = addDays(
        startOfMonth(addDays(start, 32 * offset)),
        0,
      );
      return monthStart;
    });
    return months;
  }, [anchorDate]);

  const rangeStart = startOfMonth(quarter[0]);
  const rangeEnd = endOfMonth(quarter[2]);

  const quarterPlan = useMemo(
    () =>
      planRange({
        tasks,
        events,
        capacityOverrides,
        manualPlacements,
        completedInstances,
        defaultDailyCapacityMinutes: settings.defaultDailyCapacityMinutes,
        rangeStart,
        rangeEnd,
      }),
    [
      tasks,
      events,
      capacityOverrides,
      manualPlacements,
      completedInstances,
      settings.defaultDailyCapacityMinutes,
      rangeStart,
      rangeEnd,
    ],
  );

  // Recurring monthly/quarterly instances mapped to where they're expected
  // to land (flexible markers — these may differ from the planner's actual
  // placements if the planner moved them due to overload).
  const flexibleMarkers = useMemo(() => {
    const all = allInstancesInRange(tasks, rangeStart, rangeEnd);
    return all.filter(
      (i) =>
        i.task.kind === 'recurring' &&
        (i.task.recurrence?.frequency === 'monthly' ||
          i.task.recurrence?.frequency === 'quarterly'),
    );
  }, [tasks, rangeStart, rangeEnd]);

  // Index everything by month for quick lookup
  const dayMap = new Map(quarterPlan.days.map((d) => [d.date, d]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const today = todayISO();

  const filter = useViewFilter('quarterly', ['recurring-quarterly']);
  const blockVisible = (b: ScheduledBlock) =>
    filter.active.has(categoryForBlock(b, taskById));

  const goWeek = (iso: string) => {
    setAnchorDate(iso);
    setViewMode('weekly');
  };
  const goMonth = (iso: string) => {
    setAnchorDate(iso);
    setViewMode('monthly');
  };

  const qIdx = Math.floor(fromISODate(quarter[0]).getMonth() / 3);
  const year = fromISODate(quarter[0]).getFullYear();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="font-display text-3xl text-ink-900">
            Q{qIdx + 1} {year}
          </div>
          <div className="text-sm text-ink-500 mt-1">
            {MONTH_NAMES[fromISODate(quarter[0]).getMonth()]} –{' '}
            {MONTH_NAMES[fromISODate(quarter[2]).getMonth()]} · planning at a
            glance
          </div>
        </div>
        <ViewFilterToggle {...filter} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {quarter.map((monthStart) => {
          const monthEnd = endOfMonth(monthStart);
          const days = quarterPlan.days.filter(
            (d) => d.date >= monthStart && d.date <= monthEnd,
          );
          const planned = days.reduce(
            (s, d) =>
              s +
              d.blocks
                .filter(blockVisible)
                .reduce((x, b) => x + b.minutes, 0),
            0,
          );
          const cap = days.reduce((s, d) => s + d.capacityMinutes, 0);
          const overloadedDays = days.filter(
            (d) =>
              d.blocks.filter(blockVisible).reduce((s, b) => s + b.minutes, 0) >
              d.capacityMinutes,
          ).length;

          // Markers for this month (monthly + quarterly), respecting filter
          const markers = flexibleMarkers
            .filter((m) => m.date >= monthStart && m.date <= monthEnd)
            .filter((m) => filter.active.has(categoryForTask(m.task)))
            .sort((a, b) => (a.date < b.date ? -1 : 1));

          // Notable events — gated by the "event" filter
          const eventsInMonth = filter.active.has('event')
            ? events
                .filter((e) => {
                  const d = localDateFromISO(e.start);
                  return d >= monthStart && d <= monthEnd;
                })
                .slice(0, 4)
            : [];

          // Deadlines (one-time tasks) — also under the "event" filter
          const deadlines = filter.active.has('event')
            ? tasks
                .filter(
                  (t) =>
                    t.deadline &&
                    t.deadline >= monthStart &&
                    t.deadline <= monthEnd,
                )
                .slice(0, 4)
            : [];

          return (
            <div key={monthStart} className="card p-4 flex flex-col">
              <button
                onClick={() => goMonth(monthStart)}
                className="text-left"
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-display text-2xl text-ink-900">
                    {formatMonthYear(monthStart)}
                  </div>
                  <div
                    className={clsx(
                      'text-xs font-medium',
                      overloadedDays > 0 ? 'text-rose-500' : 'text-ink-400',
                    )}
                  >
                    {overloadedDays > 0
                      ? `${overloadedDays} busy ${overloadedDays === 1 ? 'day' : 'days'}`
                      : 'comfortable'}
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-sand-100 overflow-hidden">
                  <div
                    className={clsx(
                      'h-full',
                      planned > cap ? 'bg-rose-400' : 'bg-sage-400',
                    )}
                    style={{
                      width: `${Math.min(100, (planned / Math.max(cap, 1)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-ink-500">
                  {Math.round(planned / 60)}h planned · {Math.round(cap / 60)}h
                  capacity
                </div>
              </button>

              {/* Mini calendar */}
              <MiniMonthGrid
                monthStart={monthStart}
                dayMap={dayMap}
                today={today}
                onPickDay={goWeek}
                blockVisible={blockVisible}
              />

              <Section title="Recurring placements" emptyText="No monthly/quarterly tasks">
                {markers.map((m) => {
                  const task = taskById.get(m.task.id);
                  return (
                    <div
                      key={m.instanceKey}
                      className="flex items-center justify-between text-xs py-1"
                    >
                      <span className="truncate text-ink-700">
                        {task?.name}
                      </span>
                      <span className="text-ink-400 ml-2 flex-shrink-0">
                        {fromISODate(m.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                        {m.flexible && (
                          <span className="ml-1 text-clay-400">·flex</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </Section>

              <Section title="Major events" emptyText="No events">
                {eventsInMonth.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between text-xs py-1"
                  >
                    <span className="truncate text-ink-700">{e.title}</span>
                    <span className="text-ink-400 ml-2 flex-shrink-0">
                      {new Date(e.start).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                ))}
              </Section>

              <Section title="Deadlines" emptyText="No deadlines">
                {deadlines.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between text-xs py-1"
                  >
                    <span className="truncate text-ink-700">{t.name}</span>
                    <span className="text-rose-400 ml-2 flex-shrink-0">
                      {t.deadline}
                    </span>
                  </div>
                ))}
              </Section>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniMonthGrid({
  monthStart,
  dayMap,
  today,
  onPickDay,
  blockVisible,
}: {
  monthStart: string;
  dayMap: Map<string, DayPlan>;
  today: string;
  onPickDay: (iso: string) => void;
  blockVisible: (b: ScheduledBlock) => boolean;
}) {
  const monthEnd = endOfMonth(monthStart);
  const cells: (string | null)[] = [];
  // Pad before
  const firstDow = fromISODate(monthStart).getDay();
  for (let i = 0; i < firstDow; i++) cells.push(null);
  let cur = monthStart;
  while (cur <= monthEnd) {
    cells.push(cur);
    cur = addDays(cur, 1);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="mt-3 grid grid-cols-7 gap-1">
      {cells.map((iso, i) => {
        if (!iso) return <div key={i} />;
        const day = dayMap.get(iso);
        const planned = day
          ? day.blocks.filter(blockVisible).reduce((s, b) => s + b.minutes, 0)
          : 0;
        const overloaded = day
          ? planned > day.capacityMinutes
          : false;
        const intensity =
          day && day.capacityMinutes > 0
            ? Math.min(1, planned / day.capacityMinutes)
            : 0;
        const isToday = iso === today;
        return (
          <button
            key={iso}
            onClick={() => onPickDay(iso)}
            className={clsx(
              'aspect-square rounded-md text-[10px] grid place-items-center transition-colors',
              isToday && 'ring-2 ring-sage-400',
              overloaded
                ? 'bg-rose-200 text-rose-500'
                : 'bg-sand-100 text-ink-500 hover:bg-sage-100',
            )}
            style={
              !overloaded
                ? {
                    backgroundColor: `rgba(85,129,83,${0.05 + intensity * 0.35})`,
                  }
                : undefined
            }
            title={`${iso} — ${Math.round(planned / 60)}h planned`}
          >
            {fromISODate(iso).getDate()}
          </button>
        );
      })}
    </div>
  );
}

function Section({
  title,
  children,
  emptyText,
}: {
  title: string;
  children: React.ReactNode;
  emptyText: string;
}) {
  const arr = Array.isArray(children) ? children : [children];
  const hasContent = arr.filter(Boolean).length > 0;
  return (
    <div className="mt-3 border-t border-sand-200 pt-3">
      <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-1">
        {title}
      </div>
      {hasContent ? (
        <div>{children}</div>
      ) : (
        <div className="text-xs italic text-ink-400">{emptyText}</div>
      )}
    </div>
  );
}
