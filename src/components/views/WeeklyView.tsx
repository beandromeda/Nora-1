import { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';

import { usePlanner } from '../../state/usePlanner';
import { DayColumn } from '../DayColumn';
import { CapacityModal } from '../CapacityModal';
import { formatDuration } from '../../lib/dates';
import { dayLoadMinutes } from '../../lib/planner';
import { CapacityBar } from '../CapacityBar';
import { TaskDetailModal } from '../tasks/TaskDetailModal';

export function WeeklyView() {
  const {
    weeklyPlan,
    tasks,
    events,
    settings,
    setManualPlacement,
    toggleInstanceComplete,
  } = usePlanner();

  const [capacityDate, setCapacityDate] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const eventById = useMemo(
    () => new Map(events.map((e) => [e.id, e])),
    [events],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const instanceKey = active.data.current?.instanceKey as string | undefined;
    const targetDate = over.data.current?.date as string | undefined;
    if (!instanceKey || !targetDate) return;
    setManualPlacement(instanceKey, targetDate);
  };

  const totalCapacity = weeklyPlan.days.reduce(
    (s, d) => s + d.capacityMinutes,
    0,
  );
  const totalPlanned = weeklyPlan.days.reduce(
    (s, d) => s + dayLoadMinutes(d),
    0,
  );

  const selectedBlock =
    selectedBlockId &&
    weeklyPlan.days
      .flatMap((d) => d.blocks)
      .find((b) => b.id === selectedBlockId);

  return (
    <div className="p-6 flex flex-col gap-4">
      {/* Week summary strip */}
      <div className="card p-4 flex items-center gap-6">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-ink-400 font-semibold mb-1">
            Week capacity
          </div>
          <CapacityBar
            plannedMinutes={totalPlanned}
            capacityMinutes={totalCapacity}
            warnThreshold={settings.capacityWarningThreshold}
          />
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Stat label="Events" value={countEvents(weeklyPlan)} />
          <Stat label="Tasks" value={countTasks(weeklyPlan)} />
          {weeklyPlan.unplaced.length > 0 ? (
            <Stat
              label="Unplaced"
              value={weeklyPlan.unplaced.length}
              tone="rose"
            />
          ) : (
            <Stat label="Free" value={formatDuration(Math.max(0, totalCapacity - totalPlanned))} />
          )}
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-2">
          {weeklyPlan.days.map((day) => (
            <DayColumn
              key={day.date}
              day={day}
              taskById={taskById}
              eventById={eventById}
              onSelectBlock={(id) => setSelectedBlockId(id)}
              onCompleteInstance={toggleInstanceComplete}
              onAdjustCapacity={setCapacityDate}
              warnThreshold={settings.capacityWarningThreshold}
            />
          ))}
        </div>
      </DndContext>

      {/* Unplaced backlog */}
      {weeklyPlan.unplaced.length > 0 && (
        <div className="card p-4">
          <div className="text-sm font-medium text-ink-900 mb-2">
            Couldn't fit this week
          </div>
          <ul className="space-y-1.5">
            {weeklyPlan.unplaced.map((u) => {
              const task = taskById.get(u.taskId);
              return (
                <li
                  key={u.instanceKey}
                  className="flex items-start gap-3 text-sm"
                >
                  <span className="pill bg-rose-100 text-rose-500">
                    {formatDuration(u.remainingMinutes)}
                  </span>
                  <span className="font-medium text-ink-700">
                    {task?.name ?? 'Task'}
                  </span>
                  <span className="text-ink-500">— {u.reason}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <CapacityModal date={capacityDate} onClose={() => setCapacityDate(null)} />
      {selectedBlock && (
        <TaskDetailModal
          block={selectedBlock}
          onClose={() => setSelectedBlockId(null)}
        />
      )}
    </div>
  );
}

function countEvents(plan: ReturnType<typeof usePlanner>['weeklyPlan']) {
  return plan.days.reduce(
    (s, d) => s + d.blocks.filter((b) => b.kind === 'event').length,
    0,
  );
}
function countTasks(plan: ReturnType<typeof usePlanner>['weeklyPlan']) {
  return plan.days.reduce(
    (s, d) => s + d.blocks.filter((b) => b.kind === 'task').length,
    0,
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  tone?: 'default' | 'rose';
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-400 font-semibold">
        {label}
      </div>
      <div
        className={
          'font-display text-2xl ' +
          (tone === 'rose' ? 'text-rose-500' : 'text-ink-900')
        }
      >
        {value}
      </div>
    </div>
  );
}
