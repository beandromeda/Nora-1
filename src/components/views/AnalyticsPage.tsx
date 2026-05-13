import { useMemo, useState } from 'react';
import clsx from 'clsx';

import { usePlanner } from '../../state/usePlanner';
import { addDays, fromISODate, todayISO } from '../../lib/dates';
import type { Habit, MoodScore } from '../../types';
import { WATER_OUNCES_PER_CUP } from '../../types';
import { BarChart, Droplet, Flame, Sparkles } from '../icons';

type RangeDays = 7 | 30 | 90;

const COLOR_CLASSES = {
  sage:     { dot: 'bg-sage-500',     bar: 'bg-sage-400',     soft: 'bg-sage-200/60',     text: 'text-sage-600' },
  lavender: { dot: 'bg-lavender-500', bar: 'bg-lavender-400', soft: 'bg-lavender-200/60', text: 'text-lavender-500' },
  sky:      { dot: 'bg-sky-500',      bar: 'bg-sky-400',      soft: 'bg-sky-200/60',      text: 'text-sky-500' },
  clay:     { dot: 'bg-clay-400',     bar: 'bg-clay-400',     soft: 'bg-clay-200/60',     text: 'text-clay-400' },
  rose:     { dot: 'bg-rose-400',     bar: 'bg-rose-400',     soft: 'bg-rose-200/60',     text: 'text-rose-400' },
} as const;

const MOOD_EMOJI: Record<MoodScore, string> = {
  1: '😔',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😊',
};

export function AnalyticsPage() {
  const { habits, isHabitDoneOn, moodEntries, dailyMetrics, settings } = usePlanner();
  const waterGoalOz = settings.waterDailyGoalOz;
  const calorieGoal = settings.calorieDailyGoal;
  const [range, setRange] = useState<RangeDays>(30);
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayISO();
  const dateList = useMemo(() => {
    const out: string[] = [];
    for (let i = range - 1; i >= 0; i--) out.push(addDays(today, -i));
    return out;
  }, [today, range]);

  // Per-habit metrics
  const habitMetrics = useMemo(
    () =>
      habits.map((h) => {
        let done = 0;
        let curStreak = 0;
        let bestStreak = 0;
        let runningStreak = 0;
        for (const d of dateList) {
          if (isHabitDoneOn(h.id, d)) {
            done += 1;
            runningStreak += 1;
            bestStreak = Math.max(bestStreak, runningStreak);
          } else {
            runningStreak = 0;
          }
        }
        // current streak from today backwards
        let cursor = today;
        while (isHabitDoneOn(h.id, cursor)) {
          curStreak += 1;
          cursor = addDays(cursor, -1);
        }
        const rate = dateList.length === 0 ? 0 : done / dateList.length;
        return { habit: h, done, total: dateList.length, rate, curStreak, bestStreak };
      }),
    [habits, dateList, today, isHabitDoneOn],
  );

  // Mood metrics
  const moodSeries = useMemo(
    () =>
      dateList.map((d) => ({
        date: d,
        score: (moodEntries[d]?.score ?? null) as MoodScore | null,
      })),
    [dateList, moodEntries],
  );
  const recordedMoods = moodSeries.filter((m) => m.score !== null) as {
    date: string;
    score: MoodScore;
  }[];
  const avgMood =
    recordedMoods.length === 0
      ? null
      : recordedMoods.reduce((s, m) => s + m.score, 0) / recordedMoods.length;

  const totalCompletions = habitMetrics.reduce((s, m) => s + m.done, 0);
  const longestStreak = habitMetrics.reduce(
    (s, m) => Math.max(s, m.bestStreak),
    0,
  );

  // Wellness series — water (oz) + calories per day across the range.
  const wellnessSeries = useMemo(
    () =>
      dateList.map((d) => {
        const m = dailyMetrics[d];
        return {
          date: d,
          waterOz: (m?.waterCups ?? 0) * WATER_OUNCES_PER_CUP,
          calories: m?.calories ?? 0,
        };
      }),
    [dateList, dailyMetrics],
  );
  const waterDays = wellnessSeries.filter((d) => d.waterOz > 0);
  const calorieDays = wellnessSeries.filter((d) => d.calories > 0);
  const avgWaterOz =
    waterDays.length === 0
      ? 0
      : waterDays.reduce((s, d) => s + d.waterOz, 0) / waterDays.length;
  const avgCalories =
    calorieDays.length === 0
      ? 0
      : calorieDays.reduce((s, d) => s + d.calories, 0) / calorieDays.length;
  const maxWaterOz = Math.max(waterGoalOz, ...wellnessSeries.map((d) => d.waterOz));
  const maxCalories = Math.max(calorieGoal, ...wellnessSeries.map((d) => d.calories));

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    setInsights(null);
    try {
      const snapshot = {
        today,
        range_days: range,
        habits: habits.map((h) => ({
          id: h.id,
          name: h.name,
          category: h.category,
        })),
        habit_completions_in_range: habitMetrics.map((m) => ({
          habit_id: m.habit.id,
          habit_name: m.habit.name,
          done: m.done,
          total: m.total,
          completion_rate_pct: Math.round(m.rate * 100),
          current_streak: m.curStreak,
          best_streak_in_range: m.bestStreak,
        })),
        mood_entries: recordedMoods.map((m) => ({
          date: m.date,
          score: m.score,
          note: moodEntries[m.date]?.note,
        })),
        mood_average: avgMood,
        days_with_mood_recorded: recordedMoods.length,
        wellness: {
          water_daily_goal_oz: waterGoalOz,
          calorie_daily_goal: calorieGoal,
          average_water_oz: Math.round(avgWaterOz),
          days_with_water_logged: waterDays.length,
          average_calories: Math.round(avgCalories),
          days_with_calories_logged: calorieDays.length,
          per_day: wellnessSeries
            .filter((d) => d.waterOz > 0 || d.calories > 0)
            .map((d) => ({ date: d.date, water_oz: d.waterOz, calories: d.calories })),
        },
      };
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Insights failed (${res.status})`);
      }
      const json = (await res.json()) as { reply: string };
      setInsights(json.reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="font-display text-3xl text-ink-900">Analytics</div>
          <div className="text-sm text-ink-500 mt-1">
            How your habits and mood are trending — and what Nora notices.
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-sand-50 border border-sand-200">
          {([7, 30, 90] as RangeDays[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                range === r
                  ? 'bg-sand-200 text-ink-900 shadow-soft'
                  : 'text-ink-500 hover:text-ink-700',
              )}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi
          label="Habit completions"
          value={`${totalCompletions}`}
          hint={`across ${range} days`}
          accent="sage"
        />
        <Kpi
          label="Average mood"
          value={avgMood ? `${avgMood.toFixed(1)} / 5` : '—'}
          hint={
            recordedMoods.length === 0
              ? 'No check-ins yet'
              : `${recordedMoods.length} check-${recordedMoods.length === 1 ? 'in' : 'ins'}`
          }
          accent="lavender"
        />
        <Kpi
          label="Longest streak"
          value={`${longestStreak} ${longestStreak === 1 ? 'day' : 'days'}`}
          hint="any habit"
          accent="clay"
        />
      </div>

      {/* Habits */}
      <section className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart className="w-4 h-4 text-sage-500" />
          <h2 className="font-display text-xl text-ink-900">Habits</h2>
        </div>
        {habits.length === 0 ? (
          <div className="text-sm text-ink-400 italic py-4">
            No habits yet. Add some on the Habits tab to start tracking.
          </div>
        ) : (
          <div className="space-y-3">
            {habitMetrics.map(({ habit, done, total, rate, curStreak, bestStreak }) => {
              const colorKey = (habit.color ?? 'lavender') as keyof typeof COLOR_CLASSES;
              const colors = COLOR_CLASSES[colorKey];
              return (
                <div key={habit.id} className="flex items-center gap-3">
                  <div
                    className={clsx(
                      'w-9 h-9 rounded-xl grid place-items-center text-base flex-shrink-0 text-sand-50',
                      colors.dot,
                    )}
                  >
                    {habit.icon ?? '✦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <div className="font-medium text-ink-900 truncate">
                        {habit.name}
                      </div>
                      <div className="text-xs text-ink-400 flex-shrink-0">
                        {done}/{total} · {Math.round(rate * 100)}%
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-sand-200 overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full transition-all', colors.bar)}
                        style={{ width: `${rate * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 w-20 flex-shrink-0">
                    <div className="flex items-center gap-1 text-xs text-clay-400">
                      <Flame className="w-3.5 h-3.5" />
                      {curStreak}
                    </div>
                    <div className="text-[10px] text-ink-400">
                      best {bestStreak}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Wellness: water + calories */}
      <section className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Droplet className="w-4 h-4 text-sky-500" />
          <h2 className="font-display text-xl text-ink-900">Wellness</h2>
        </div>
        {waterDays.length === 0 && calorieDays.length === 0 ? (
          <div className="text-sm text-ink-400 italic py-4">
            No water or calories logged yet. Track them from the Daily tab.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <WellnessChart
              label="Water"
              unit="oz"
              accent="sky"
              avg={Math.round(avgWaterOz)}
              goal={waterGoalOz}
              series={wellnessSeries.map((d) => ({ date: d.date, value: d.waterOz }))}
              max={maxWaterOz}
              loggedDays={waterDays.length}
            />
            <WellnessChart
              label="Calories"
              unit="kcal"
              accent="clay"
              avg={Math.round(avgCalories)}
              goal={calorieGoal}
              series={wellnessSeries.map((d) => ({ date: d.date, value: d.calories }))}
              max={maxCalories}
              loggedDays={calorieDays.length}
            />
          </div>
        )}
      </section>

      {/* Mood chart */}
      <section className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-lavender-500" />
          <h2 className="font-display text-xl text-ink-900">Mood</h2>
        </div>
        {recordedMoods.length === 0 ? (
          <div className="text-sm text-ink-400 italic py-4">
            No mood check-ins yet. Add one from the Daily tab.
          </div>
        ) : (
          <MoodChart series={moodSeries} />
        )}
      </section>

      {/* AI Insights */}
      <section className="card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sage-500" />
            <h2 className="font-display text-xl text-ink-900">AI insights</h2>
          </div>
          <button
            onClick={fetchInsights}
            disabled={loading || (habits.length === 0 && recordedMoods.length === 0)}
            className={clsx(
              'btn-primary',
              loading && 'opacity-70 cursor-wait',
            )}
          >
            {loading ? 'Reading the tea leaves…' : 'Generate insights'}
          </button>
        </div>
        {error && (
          <div className="mt-3 text-sm text-rose-400 bg-rose-100/30 border border-rose-300 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        {insights && (
          <div className="mt-4 prose-sm leading-relaxed text-ink-700 whitespace-pre-wrap">
            {insights}
          </div>
        )}
        {!insights && !loading && !error && (
          <div className="mt-3 text-sm text-ink-400 italic">
            Click "Generate insights" to ask Claude to look at your habit and
            mood patterns over the last {range} days.
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: keyof typeof COLOR_CLASSES;
}) {
  const colors = COLOR_CLASSES[accent];
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-ink-400 font-semibold">
        {label}
      </div>
      <div className={clsx('font-display text-3xl mt-1', colors.text)}>
        {value}
      </div>
      {hint && <div className="text-xs text-ink-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function MoodChart({
  series,
}: {
  series: { date: string; score: MoodScore | null }[];
}) {
  const W = 100;
  const H = 40;
  const n = series.length;
  // Build the path between recorded points, skipping nulls.
  const points = series
    .map((s, i) => {
      if (s.score === null) return null;
      const x = n === 1 ? W / 2 : (i / (n - 1)) * W;
      const y = H - ((s.score - 1) / 4) * H;
      return { x, y, score: s.score, date: s.date };
    })
    .filter(Boolean) as { x: number; y: number; score: MoodScore; date: string }[];

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-32"
      >
        {/* Horizontal guide lines for scores 1..5 */}
        {[1, 2, 3, 4, 5].map((s) => (
          <line
            key={s}
            x1={0}
            y1={H - ((s - 1) / 4) * H}
            x2={W}
            y2={H - ((s - 1) / 4) * H}
            stroke="rgba(236,237,242,0.06)"
            strokeWidth={0.4}
          />
        ))}
        {points.length > 1 && (
          <path
            d={pathD}
            fill="none"
            stroke="#b8a8d0"
            strokeWidth={1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={1.4}
            fill="#b8a8d0"
            stroke="#1a1e29"
            strokeWidth={0.6}
          />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-ink-400 mt-1">
        <span>{firstDate(series)}</span>
        <span>
          avg {recordedAverage(series).toFixed(1)} {emojiFor(recordedAverage(series))}
        </span>
        <span>{lastDate(series)}</span>
      </div>
    </div>
  );
}

function firstDate(series: { date: string }[]) {
  return series[0] ? formatTickDate(series[0].date) : '';
}
function lastDate(series: { date: string }[]) {
  return series.length > 0 ? formatTickDate(series[series.length - 1].date) : '';
}
function formatTickDate(iso: string): string {
  const d = fromISODate(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function recordedAverage(series: { score: MoodScore | null }[]): number {
  const vals = series
    .map((s) => s.score)
    .filter((s): s is MoodScore => s !== null);
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
function emojiFor(avg: number): string {
  if (avg <= 0) return '';
  const rounded = Math.max(1, Math.min(5, Math.round(avg))) as MoodScore;
  return MOOD_EMOJI[rounded];
}

function WellnessChart({
  label,
  unit,
  accent,
  avg,
  goal,
  series,
  max,
  loggedDays,
}: {
  label: string;
  unit: string;
  accent: keyof typeof COLOR_CLASSES;
  avg: number;
  goal?: number;
  series: { date: string; value: number }[];
  max: number;
  loggedDays: number;
}) {
  const colors = COLOR_CLASSES[accent];
  // Trim to last ~30 entries to keep the bars readable.
  const visible = series.slice(-30);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="text-sm font-medium text-ink-900">{label}</div>
        <div className={clsx('text-xs', colors.text)}>
          avg {avg.toLocaleString()} {unit}
          {goal ? ` / ${goal} ${unit} goal` : ''}
        </div>
      </div>
      <div className="flex items-end gap-0.5 h-20">
        {visible.map((d) => {
          const pct = max === 0 ? 0 : (d.value / max) * 100;
          const meetsGoal = goal !== undefined && d.value >= goal;
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col justify-end"
              title={`${formatTickDate(d.date)}: ${d.value.toLocaleString()} ${unit}`}
            >
              <div
                className={clsx(
                  'w-full rounded-sm transition-all',
                  d.value === 0
                    ? 'bg-sand-200'
                    : meetsGoal
                      ? colors.bar
                      : colors.soft,
                )}
                style={{ height: `${Math.max(d.value > 0 ? 6 : 4, pct)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-ink-400 mt-1">
        <span>{visible[0] ? formatTickDate(visible[0].date) : ''}</span>
        <span>
          {loggedDays} {loggedDays === 1 ? 'day' : 'days'} logged
        </span>
        <span>
          {visible.length > 0
            ? formatTickDate(visible[visible.length - 1].date)
            : ''}
        </span>
      </div>
    </div>
  );
}

// Suppress unused-import warning for Habit type used in nested sub-component
// signatures via the metrics structure — kept here to make the data shape
// explicit.
export type _UsedHabit = Habit;
