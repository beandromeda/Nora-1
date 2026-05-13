import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';

import { usePlanner } from '../../state/usePlanner';
import { dayLoadMinutes, planRange } from '../../lib/planner';
import {
  fromISODate,
  formatLongDate,
  WEEKDAYS_LONG,
  todayISO,
} from '../../lib/dates';
import { DayTimeGrid } from '../DayTimeGrid';
import { CapacityBar } from '../CapacityBar';
import { CapacityModal } from '../CapacityModal';
import { TaskDetailModal } from '../tasks/TaskDetailModal';
import type { MoodScore } from '../../types';
import { WATER_OUNCES_PER_CUP } from '../../types';
import {
  Check,
  Droplet,
  Flame,
  Minus,
  Pencil,
  Plus,
  Sparkles,
  Sun,
  X,
} from '../icons';

const MOOD_OPTIONS: { score: MoodScore; emoji: string; label: string }[] = [
  { score: 1, emoji: '😔', label: 'Rough' },
  { score: 2, emoji: '😕', label: 'Low' },
  { score: 3, emoji: '😐', label: 'Okay' },
  { score: 4, emoji: '🙂', label: 'Good' },
  { score: 5, emoji: '😊', label: 'Great' },
];

const HABIT_COLORS = {
  sage: 'bg-sage-200/40 border-sage-300 text-sage-700',
  lavender: 'bg-lavender-200/40 border-lavender-300 text-lavender-500',
  sky: 'bg-sky-200/40 border-sky-300 text-sky-500',
  clay: 'bg-clay-200/40 border-clay-300 text-clay-400',
  rose: 'bg-rose-200/40 border-rose-300 text-rose-400',
} as const;

const HABIT_DOTS = {
  sage: 'bg-sage-500',
  lavender: 'bg-lavender-500',
  sky: 'bg-sky-500',
  clay: 'bg-clay-400',
  rose: 'bg-rose-400',
} as const;

export function DailyView() {
  const {
    tasks,
    events,
    capacityOverrides,
    manualPlacements,
    completedInstances,
    settings,
    anchorDate,
    setTopTab,
    toggleInstanceComplete,
    habits,
    isHabitDoneOn,
    toggleHabitCompletion,
    moodEntries,
    setMood,
    habitCompletionsList,
    dailyMetrics,
    addWaterCup,
    removeWaterCup,
    resetWater,
    addCalories,
    resetCalories,
    updateSettings,
    setManualPlacement,
    setScheduledTime,
    clearScheduledTime,
    scheduledTimes,
  } = usePlanner();

  const date = anchorDate;
  const today = todayISO();
  const isToday = date === today;
  const dow = fromISODate(date).getDay();

  const dayPlan = useMemo(() => {
    const result = planRange({
      tasks,
      events,
      capacityOverrides,
      manualPlacements,
      completedInstances,
      scheduledTimes,
      defaultDailyCapacityMinutes: settings.defaultDailyCapacityMinutes,
      rangeStart: date,
      rangeEnd: date,
    });
    return result.days[0];
  }, [
    tasks,
    events,
    capacityOverrides,
    manualPlacements,
    completedInstances,
    scheduledTimes,
    settings.defaultDailyCapacityMinutes,
    date,
  ]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const eventById = useMemo(
    () => new Map(events.map((e) => [e.id, e])),
    [events],
  );

  const [capacityDate, setCapacityDate] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const instanceKey = active.data.current?.instanceKey as string | undefined;
    if (!instanceKey) return;
    const overData = over.data.current as
      | { date?: string; kind?: 'unscheduled' | 'slot'; hour?: string }
      | undefined;
    if (!overData?.date) return;
    // Always pin the day so the block sticks to today even if its preferred
    // date is elsewhere (and so re-ordering doesn't shuffle it back).
    setManualPlacement(instanceKey, overData.date);
    if (overData.kind === 'slot' && overData.hour) {
      setScheduledTime(instanceKey, overData.hour);
    } else {
      clearScheduledTime(instanceKey);
    }
  };

  const selectedBlock =
    selectedBlockId && dayPlan?.blocks.find((b) => b.id === selectedBlockId);

  const todayMood = moodEntries[date];
  const [moodNote, setMoodNote] = useState(todayMood?.note ?? '');
  const [pendingScore, setPendingScore] = useState<MoodScore | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);

  // Reset local note state when the day changes or stored note changes from
  // outside (e.g. cleared on a different surface).
  useEffect(() => {
    setMoodNote(todayMood?.note ?? '');
    setPendingScore(null);
  }, [date, todayMood?.note]);

  const flashSaved = () => {
    setSavedFlash(true);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setSavedFlash(false), 1600);
  };

  useEffect(() => {
    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, []);

  const activeScore = (pendingScore ?? todayMood?.score) as MoodScore | undefined;

  const handlePickMood = (score: MoodScore) => {
    setPendingScore(score);
    setMood(date, score, moodNote.trim() || undefined);
    flashSaved();
  };

  const handleSaveNote = () => {
    if (!activeScore) return;
    setMood(date, activeScore, moodNote.trim() || undefined);
    flashSaved();
  };

  // ---------- Wellness: water + calories --------------------------------
  const todayMetrics = dailyMetrics[date];
  const waterCups = todayMetrics?.waterCups ?? 0;
  const waterOunces = waterCups * WATER_OUNCES_PER_CUP;
  const waterGoalOz = settings.waterDailyGoalOz;
  const calorieGoal = settings.calorieDailyGoal;
  const waterPct = Math.min(
    100,
    waterGoalOz > 0 ? (waterOunces / waterGoalOz) * 100 : 0,
  );
  const calorieTotal = todayMetrics?.calories ?? 0;
  const caloriePct = Math.min(
    100,
    calorieGoal > 0 ? (calorieTotal / calorieGoal) * 100 : 0,
  );
  const [calorieInput, setCalorieInput] = useState('');

  const handleAddCalories = () => {
    const n = Number(calorieInput);
    if (!Number.isFinite(n) || n <= 0) return;
    addCalories(date, Math.round(n));
    setCalorieInput('');
  };

  // Inline goal editing for water + calories. We keep a draft string so the
  // user can clear the field while typing without immediately committing a 0.
  const [editingGoal, setEditingGoal] = useState<'water' | 'calories' | null>(null);
  const [goalDraft, setGoalDraft] = useState('');

  const openGoalEditor = (which: 'water' | 'calories') => {
    setEditingGoal(which);
    setGoalDraft(String(which === 'water' ? waterGoalOz : calorieGoal));
  };

  const commitGoalEditor = () => {
    if (!editingGoal) return;
    const n = Number(goalDraft);
    if (Number.isFinite(n) && n > 0) {
      const rounded = Math.round(n);
      if (editingGoal === 'water') updateSettings({ waterDailyGoalOz: rounded });
      else updateSettings({ calorieDailyGoal: rounded });
    }
    setEditingGoal(null);
  };

  const cancelGoalEditor = () => setEditingGoal(null);

  // streak helper: consecutive days ending today (or earlier) where habit is done
  const habitStreak = (habitId: string) => {
    let streak = 0;
    let cursor = date;
    while (true) {
      if (isHabitDoneOn(habitId, cursor)) {
        streak += 1;
        const d = fromISODate(cursor);
        d.setDate(d.getDate() - 1);
        cursor = d.toISOString().slice(0, 10);
      } else break;
    }
    return streak;
  };

  const completedToday = habits.filter((h) => isHabitDoneOn(h.id, date)).length;

  const last7Mood = useMemo(() => {
    const out: { date: string; score: MoodScore | null }[] = [];
    const base = fromISODate(date);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      out.push({ date: iso, score: moodEntries[iso]?.score ?? null });
    }
    return out;
  }, [date, moodEntries]);

  return (
    <div className="p-3 sm:p-6 flex flex-col gap-4 sm:gap-5">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <div className="font-display text-2xl sm:text-3xl text-ink-900">
            {isToday ? 'Today' : WEEKDAYS_LONG[dow]}
          </div>
          <div className="text-sm text-ink-400 mt-1">{formatLongDate(date)}</div>
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-500">
          <Sun className="w-4 h-4 text-clay-400" />
          {dayPlan
            ? (() => {
                const open = dayPlan.blocks.filter((b) => !b.completed).length;
                const done = dayPlan.blocks.length - open;
                return `${open} ${open === 1 ? 'item' : 'items'} planned${done > 0 ? ` · ${done} done` : ''}`;
              })()
            : ''}
        </div>
      </div>

      {/* Schedule */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <SectionHeader title="Schedule" />
          <button
            onClick={() => setCapacityDate(date)}
            className="text-xs text-ink-400 hover:text-ink-700"
          >
            Adjust day capacity
          </button>
        </div>
        {dayPlan && (
          <>
            <div className="card px-4 py-3">
              <CapacityBar
                plannedMinutes={dayLoadMinutes(dayPlan)}
                capacityMinutes={dayPlan.capacityMinutes}
                size="sm"
                warnThreshold={settings.capacityWarningThreshold}
              />
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragEnd={handleDragEnd}
            >
              <DayTimeGrid
                day={dayPlan}
                taskById={taskById}
                eventById={eventById}
                onSelectBlock={setSelectedBlockId}
                onCompleteInstance={toggleInstanceComplete}
              />
            </DndContext>
          </>
        )}
      </section>

      {/* Wellness: water + calories */}
      <section className="space-y-2">
        <SectionHeader title="Wellness" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Water */}
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-500 grid place-items-center flex-shrink-0">
                  <Droplet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-ink-900">Water</div>
                  <div className="text-xs text-ink-400 flex items-center gap-1.5">
                    <span>{WATER_OUNCES_PER_CUP} oz per cup · goal</span>
                    {editingGoal === 'water' ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          autoFocus
                          value={goalDraft}
                          onChange={(e) => setGoalDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitGoalEditor();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelGoalEditor();
                            }
                          }}
                          onBlur={commitGoalEditor}
                          className="w-14 px-1.5 py-0.5 text-xs rounded border border-sand-300 bg-sand-50 text-ink-900"
                          aria-label="Daily water goal in ounces"
                        />
                        <span>oz</span>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={cancelGoalEditor}
                          className="text-ink-400 hover:text-ink-700"
                          aria-label="Cancel goal edit"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => openGoalEditor('water')}
                        className="inline-flex items-center gap-1 hover:text-ink-700"
                        aria-label="Edit water goal"
                      >
                        <span>{waterGoalOz} oz</span>
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-display text-2xl sm:text-3xl text-sky-500 leading-none">
                  {waterOunces}
                  <span className="text-base text-ink-400 ml-1">oz</span>
                </div>
                <div className="text-[11px] text-ink-400 mt-0.5">
                  {waterCups} {waterCups === 1 ? 'cup' : 'cups'}
                </div>
              </div>
            </div>

            <div className="h-2 rounded-full bg-sand-200 overflow-hidden mb-3">
              <div
                className="h-full bg-sky-400 rounded-full transition-all"
                style={{ width: `${waterPct}%` }}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => removeWaterCup(date)}
                disabled={waterCups === 0}
                className={clsx(
                  'btn text-xs',
                  waterCups === 0
                    ? 'bg-sand-200 text-ink-400 cursor-not-allowed'
                    : 'bg-sand-200 text-ink-700 hover:bg-sand-300',
                )}
                aria-label="Remove a cup"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => addWaterCup(date)}
                className="btn-primary flex-1 justify-center"
              >
                <Plus className="w-4 h-4" />
                Add {WATER_OUNCES_PER_CUP} oz
              </button>
              {waterCups > 0 && (
                <button
                  onClick={() => resetWater(date)}
                  className="text-[11px] text-ink-400 hover:text-ink-700 px-2"
                  title="Reset water for today"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Calories */}
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-clay-100 text-clay-400 grid place-items-center flex-shrink-0">
                  <Flame className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-ink-900">Calories</div>
                  <div className="text-xs text-ink-400 flex items-center gap-1.5">
                    <span>goal</span>
                    {editingGoal === 'calories' ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          autoFocus
                          value={goalDraft}
                          onChange={(e) => setGoalDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitGoalEditor();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelGoalEditor();
                            }
                          }}
                          onBlur={commitGoalEditor}
                          className="w-16 px-1.5 py-0.5 text-xs rounded border border-sand-300 bg-sand-50 text-ink-900"
                          aria-label="Daily calorie goal"
                        />
                        <span>kcal</span>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={cancelGoalEditor}
                          className="text-ink-400 hover:text-ink-700"
                          aria-label="Cancel goal edit"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => openGoalEditor('calories')}
                        className="inline-flex items-center gap-1 hover:text-ink-700"
                        aria-label="Edit calorie goal"
                      >
                        <span>{calorieGoal.toLocaleString()} kcal</span>
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-display text-2xl sm:text-3xl text-clay-400 leading-none">
                  {calorieTotal.toLocaleString()}
                  <span className="text-base text-ink-400 ml-1">kcal</span>
                </div>
                <div className="text-[11px] text-ink-400 mt-0.5">
                  {Math.max(0, calorieGoal - calorieTotal).toLocaleString()} to goal
                </div>
              </div>
            </div>

            <div className="h-2 rounded-full bg-sand-200 overflow-hidden mb-3">
              <div
                className="h-full bg-clay-400 rounded-full transition-all"
                style={{ width: `${caloriePct}%` }}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={calorieInput}
                onChange={(e) => setCalorieInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCalories();
                  }
                }}
                placeholder="e.g. 350"
                className="input flex-1"
              />
              <button
                onClick={handleAddCalories}
                disabled={!calorieInput || Number(calorieInput) <= 0}
                className={clsx(
                  'btn',
                  calorieInput && Number(calorieInput) > 0
                    ? 'bg-sage-500 text-sand-50 hover:bg-sage-400'
                    : 'bg-sand-200 text-ink-400 cursor-not-allowed',
                )}
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
              {calorieTotal > 0 && (
                <button
                  onClick={() => resetCalories(date)}
                  className="text-[11px] text-ink-400 hover:text-ink-700 px-2"
                  title="Reset calories for today"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Habits */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <SectionHeader title="Habits" />
          <div className="text-xs text-ink-400">
            {completedToday} of {habits.length} done today
          </div>
        </div>
        {habits.length === 0 ? (
          <div className="card p-6 text-center">
            <div className="text-sm text-ink-500">
              No habits yet. Add a few rhythms you'd like to build —
              like "drink water" or "10-minute walk."
            </div>
            <button
              onClick={() => setTopTab('habits')}
              className="btn-primary mt-3 inline-flex"
            >
              <Plus className="w-4 h-4" />
              Add habits
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {habits.map((habit) => {
              const done = isHabitDoneOn(habit.id, date);
              const streak = habitStreak(habit.id);
              const colorKey = (habit.color ?? 'lavender') as keyof typeof HABIT_COLORS;
              return (
                <button
                  key={habit.id}
                  onClick={() => toggleHabitCompletion(habit.id, date)}
                  className={clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left',
                    done
                      ? HABIT_COLORS[colorKey] + ' shadow-soft'
                      : 'bg-sand-100 border-sand-200 text-ink-500 hover:bg-sand-200',
                  )}
                >
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-full grid place-items-center flex-shrink-0 text-base transition-colors',
                      done
                        ? HABIT_DOTS[colorKey] + ' text-sand-50'
                        : 'bg-sand-200 text-ink-400',
                    )}
                  >
                    {habit.icon ?? '✦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={clsx('font-medium truncate', done ? '' : 'text-ink-700')}>
                      {habit.name}
                    </div>
                    {habit.category && (
                      <div className="text-[11px] text-ink-400 truncate">
                        {habit.category}
                      </div>
                    )}
                  </div>
                  {streak > 0 && (
                    <div className="flex items-center gap-1 text-xs text-clay-400 flex-shrink-0">
                      <Flame className="w-3.5 h-3.5" />
                      {streak}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Mood check-in */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <SectionHeader title="How are you feeling?" />
          <div
            className={clsx(
              'flex items-center gap-1 text-xs font-medium transition-opacity',
              savedFlash ? 'opacity-100 text-sage-500' : 'opacity-0',
            )}
            aria-live="polite"
          >
            <Check className="w-3.5 h-3.5" />
            Saved
          </div>
        </div>
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {MOOD_OPTIONS.map((m) => {
              const isActive = activeScore === m.score;
              return (
                <button
                  key={m.score}
                  onClick={() => handlePickMood(m.score)}
                  className={clsx(
                    'flex flex-col items-center gap-1 px-2 sm:px-4 py-2 sm:py-3 rounded-xl transition-all flex-1 min-w-0 sm:min-w-[70px]',
                    isActive
                      ? 'bg-lavender-200/60 ring-2 ring-lavender-400 shadow-soft scale-[1.02]'
                      : 'bg-sand-50 hover:bg-sand-200',
                  )}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span
                    className={clsx(
                      'text-xs font-medium',
                      isActive ? 'text-lavender-500' : 'text-ink-400',
                    )}
                  >
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="label">A few words about today (optional)</label>
            <textarea
              value={moodNote}
              onChange={(e) => setMoodNote(e.target.value)}
              onKeyDown={(e) => {
                // Cmd/Ctrl+Enter saves; plain Enter inserts newline as usual.
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSaveNote();
                }
              }}
              placeholder="What's on your mind, what felt good, what was hard..."
              rows={2}
              className="input resize-none"
            />
            <div className="flex items-center justify-between gap-3 mt-2">
              <span className="text-[11px] text-ink-400">
                {activeScore
                  ? 'Press ⌘/Ctrl + Enter to save your note'
                  : 'Pick a mood above to save a note'}
              </span>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={!activeScore}
                className={clsx(
                  'btn text-xs',
                  activeScore
                    ? 'bg-lavender-500 text-sand-50 hover:bg-lavender-400'
                    : 'bg-sand-200 text-ink-400 cursor-not-allowed',
                )}
              >
                <Check className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          </div>

          {/* Past 7 days preview */}
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-2">
              Last 7 days
            </div>
            <div className="flex items-end gap-1.5 h-10">
              {last7Mood.map((d) => {
                const opt = MOOD_OPTIONS.find((m) => m.score === d.score);
                const heightPct = d.score ? (d.score / 5) * 100 : 8;
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center justify-end gap-1"
                    title={d.date}
                  >
                    <div
                      className={clsx(
                        'w-full rounded-md transition-all',
                        d.score
                          ? 'bg-lavender-400'
                          : 'bg-sand-200',
                      )}
                      style={{ height: `${heightPct}%` }}
                    />
                    <div className="text-[9px] text-ink-400">
                      {opt?.emoji ?? '·'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <CapacityModal
        date={capacityDate}
        onClose={() => setCapacityDate(null)}
      />
      {selectedBlock && (
        <TaskDetailModal
          block={selectedBlock}
          onClose={() => setSelectedBlockId(null)}
        />
      )}

      {/* Avoid lint warning for unused habitCompletionsList — currently
          surfaced via streak helper, which reads through context. */}
      <span className="hidden">{habitCompletionsList.length}</span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Sparkles className="w-4 h-4 text-lavender-500" />
      <h2 className="font-display text-xl text-ink-900">{title}</h2>
    </div>
  );
}
