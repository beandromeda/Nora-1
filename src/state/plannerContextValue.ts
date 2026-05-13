import { createContext } from 'react';

import type {
  AppSettings,
  CalendarEvent,
  CapacityOverride,
  DailyMetrics,
  Habit,
  HabitCompletion,
  MoodEntry,
  MoodScore,
  Note,
  PlanResult,
  Task,
  TopTab,
  ViewMode,
} from '../types';

export interface PersistedState {
  tasks: Task[];
  events: CalendarEvent[];
  capacityOverrides: CapacityOverride[];
  manualPlacements: Record<string, string>;
  completedInstances: Record<string, boolean>;
  // instanceKey -> "HH:MM" — per-occurrence start time, pinned by dragging
  // a task into a slot in the Daily view's time grid.
  scheduledTimes: Record<string, string>;
  settings: AppSettings;
  habits: Habit[];
  // Indexed by `${habitId}__${date}` for O(1) toggle lookups.
  habitCompletions: Record<string, true>;
  // Indexed by date (one entry per day).
  moodEntries: Record<string, MoodEntry>;
  // Indexed by date — water cup counts and calorie totals per day.
  dailyMetrics: Record<string, DailyMetrics>;
  // Optional user-uploaded vision board (PDF as base64 data URL).
  visionBoardPdf?: string;
  visionBoardName?: string;
  // Free-form notes per month, keyed by "YYYY-MM".
  monthlyNotes: Record<string, string>;
  // Sticky-note style notes shown on the Notes tab.
  notes: Note[];
  // Whether the right-hand assistant panel is collapsed.  Persisted so the
  // user's preference sticks between sessions.
  assistantCollapsed: boolean;
}

export interface PlannerContextValue extends PersistedState {
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  topTab: TopTab;
  setTopTab: (t: TopTab) => void;
  anchorDate: string;
  setAnchorDate: (d: string) => void;

  weeklyPlan: PlanResult;
  monthlyPlan: PlanResult;
  quarterlyPlan: PlanResult;

  lastCapacityOverride?: CapacityOverride;

  addTask: (t: Omit<Task, 'id' | 'createdAt'>) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addEvent: (e: Omit<CalendarEvent, 'id'>) => void;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  setCapacityOverride: (date: string, minutes: number, note?: string) => void;
  clearCapacityOverride: (date: string) => void;
  setManualPlacement: (instanceKey: string, date: string) => void;
  clearManualPlacement: (instanceKey: string) => void;
  setScheduledTime: (instanceKey: string, time: string) => void;
  clearScheduledTime: (instanceKey: string) => void;
  toggleInstanceComplete: (instanceKey: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetToSamples: () => void;

  addHabit: (h: Omit<Habit, 'id' | 'createdAt'>) => void;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  toggleHabitCompletion: (habitId: string, date: string) => void;
  isHabitDoneOn: (habitId: string, date: string) => boolean;

  setMood: (date: string, score: MoodScore, note?: string) => void;
  clearMood: (date: string) => void;
  habitCompletionsList: HabitCompletion[];

  // Daily metrics (water + calories)
  addWaterCup: (date: string) => void;
  removeWaterCup: (date: string) => void;
  resetWater: (date: string) => void;
  addCalories: (date: string, amount: number) => void;
  setCalories: (date: string, total: number) => void;
  resetCalories: (date: string) => void;

  // Vision board
  setVisionBoard: (dataUrl: string, name: string) => boolean;
  clearVisionBoard: () => void;

  // Monthly notes (one persistent textarea per month)
  setMonthlyNote: (monthKey: string, text: string) => void;

  // Sticky notes
  addNote: (n?: Partial<Pick<Note, 'content' | 'color'>>) => string;
  updateNote: (id: string, patch: Partial<Pick<Note, 'content' | 'color'>>) => void;
  deleteNote: (id: string) => void;

  // Assistant panel collapse toggle
  toggleAssistantCollapsed: () => void;
}

export const PlannerContext = createContext<PlannerContextValue | null>(null);
