// Core domain types for the Nora planner.
// Times are stored as ISO date strings ("YYYY-MM-DD") for dates
// and ISO timestamp strings for events.

export type Priority = 'non-negotiable' | 'negotiable';

export type RecurrenceFrequency =
  | 'daily'
  | 'weekdays'   // Mon–Fri
  | 'weekends'   // Sat–Sun
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  // For weekly: 0..6 (Sun..Sat). For monthly/quarterly: day-of-month (1..28).
  dayOfWeek?: number;
  dayOfMonth?: number;
  // Optional anchor for "every Nth week from this date".
  anchorDate?: string;
}

export type TaskKind = 'one-time' | 'recurring';

export interface Task {
  id: string;
  name: string;
  notes?: string;
  estimatedMinutes: number;
  priority: Priority;
  kind: TaskKind;
  recurrence?: RecurrenceRule;
  preferredDate?: string;          // for one-time tasks
  preferredDayOfWeek?: number;     // 0..6 for recurring weekly
  deadline?: string;               // YYYY-MM-DD
  splittable: boolean;
  minBlockMinutes?: number;        // when split, how small can a block be
  createdAt: string;
  // For one-time tasks: tracks completion. Recurring "instances" are
  // tracked separately by completion key (taskId + dateISO).
  completed?: boolean;
}

// Repeating events (birthdays, anniversaries, monthly bill reminders).  When
// set, the `start`/`end` ISO timestamps act as the anchor (their month/day —
// and for monthly, just their day — drive the recurrence).
export type EventRecurrenceFrequency = 'yearly' | 'monthly';

export interface EventRecurrence {
  frequency: EventRecurrenceFrequency;
}

export interface CalendarEvent {
  id: string;
  title: string;
  // ISO timestamps.  For recurring events these are the anchor occurrence.
  start: string;
  end: string;
  source?: 'mock' | 'google';
  notes?: string;
  recurrence?: EventRecurrence;
}

// A scheduled block on a particular day. Either anchors to a CalendarEvent
// (fixed) or to a Task instance (movable).
export interface ScheduledBlock {
  id: string;
  date: string;                     // YYYY-MM-DD
  minutes: number;
  kind: 'event' | 'task';
  taskId?: string;
  eventId?: string;
  // Indicates this is the Nth split chunk for splittable tasks.
  partIndex?: number;
  partCount?: number;
  // True if the planner placed this on a non-preferred day due to overload.
  movedFromPreferred?: boolean;
  // Carries the instance "key" for an occurrence on a specific date.
  // Tasks: `${taskId}__${date}`. Events: `${eventId}__${date}`.
  instanceKey?: string;
  // The user has marked this specific occurrence done. For recurring items
  // only this instance is affected — future occurrences continue to surface.
  completed?: boolean;
  // Start time in the day's time-grid view, "HH:MM" (24h). For events this is
  // derived from `start`; for tasks it's set by the user dragging into a slot.
  scheduledTime?: string;
}

export interface DayPlan {
  date: string;                     // YYYY-MM-DD
  capacityMinutes: number;
  capacityOverridden?: boolean;
  blocks: ScheduledBlock[];
  // Per-task buffer minutes baked into capacity calculations for this day.
  bufferMinutes?: number;
}

export interface UnplacedTask {
  taskId: string;
  instanceKey: string;
  reason: string;
  remainingMinutes: number;
}

export interface PlanResult {
  days: DayPlan[];
  unplaced: UnplacedTask[];
  movedTasks: { instanceKey: string; from: string; to: string }[];
  rangeStart: string;
  rangeEnd: string;
}

export interface CapacityOverride {
  date: string;
  minutes: number;
  note?: string;
}

export type ViewMode = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type TopTab =
  | 'planner'
  | 'recurring'
  | 'events'
  | 'habits'
  | 'analytics'
  | 'notes'
  | 'vision'
  | 'settings';

// Sticky-note style free-form note, shown on the Notes tab.
export type NoteColor = 'sage' | 'lavender' | 'sky' | 'clay' | 'rose';

export interface Note {
  id: string;
  content: string;
  color?: NoteColor;
  createdAt: string;  // ISO timestamp
  updatedAt: string;  // ISO timestamp
}

// A habit is a simple daily check-off — no time blocks, no scheduling. It's
// tracked separately from Tasks because the mental model is different
// ("did I do this today?" not "when does this fit?").
export interface Habit {
  id: string;
  name: string;
  // Lucide-ish emoji or short symbol shown next to the habit. Optional.
  icon?: string;
  // Higher-level grouping (e.g. "Health", "Mind", "Work"). Optional.
  category?: string;
  // ISO date when it was added.
  createdAt: string;
  // Optional accent color name from the tailwind palette (sage, lavender,
  // sky, clay, rose). Defaults to lavender if unset.
  color?: 'sage' | 'lavender' | 'sky' | 'clay' | 'rose';
}

// A binary "I did this on this day" record. Storing as a flat list of
// (habitId, date) makes streak math trivial.
export interface HabitCompletion {
  habitId: string;
  date: string; // YYYY-MM-DD
}

// Per-day numeric trackers (water cups of 8 oz, calorie total, etc.). Unlike
// habits, these accumulate quantities throughout the day rather than being a
// binary yes/no.
export interface DailyMetrics {
  date: string;          // YYYY-MM-DD
  waterCups?: number;    // count of 8-oz cups consumed
  calories?: number;     // running daily total
}

// Daily water intake target in fluid ounces.  90 oz = 11.25 cups of 8 oz.
export const WATER_OUNCES_PER_CUP = 8;
export const DEFAULT_WATER_DAILY_GOAL_OZ = 90;
export const DEFAULT_CALORIE_DAILY_GOAL = 2000;

export type MoodScore = 1 | 2 | 3 | 4 | 5;

// One mood check-in per day. If the user updates it, we replace the entry
// for that date.
export interface MoodEntry {
  date: string;       // YYYY-MM-DD
  score: MoodScore;
  note?: string;
  createdAt: string;  // ISO timestamp
}

export interface AppSettings {
  defaultDailyCapacityMinutes: number;
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  // Per-weekday capacity overrides (length 7, Sunday..Saturday).
  // When undefined for a day, defaultDailyCapacityMinutes is used.
  weekdayCapacityMinutes: number[];
  // Breathing room baked between scheduled tasks (in minutes).
  bufferMinutesBetweenTasks: number;
  // Percentage (0..100). When a day's planned load crosses this share of
  // capacity, the bar shifts to a warning tone.
  capacityWarningThreshold: number;
  // Daily wellness goals shown on the Daily view cards.
  waterDailyGoalOz: number;
  calorieDailyGoal: number;
}
