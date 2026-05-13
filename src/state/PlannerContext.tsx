// Provider component for the planner. The context value type and the
// `usePlanner` hook live in sibling files so this file only exports a
// component (keeps Vite Fast Refresh happy).

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  AppSettings,
  CalendarEvent,
  CapacityOverride,
  DailyMetrics,
  Habit,
  HabitCompletion,
  MoodScore,
  Note,
  NoteColor,
  Task,
  TopTab,
  ViewMode,
} from '../types';
import { sampleEvents, sampleTasks } from '../data/mockData';
import { planRange } from '../lib/planner';
import {
  addDays,
  endOfMonth,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  todayISO,
} from '../lib/dates';
import {
  PlannerContext,
  type PersistedState,
  type PlannerContextValue,
} from './plannerContextValue';

const STORAGE_KEY = 'nora-planner.v1';
// The vision board PDF can be multi-MB; keep it in a separate localStorage
// key so a quota failure on the PDF doesn't wipe the rest of the planner.
const VISION_PDF_KEY = 'nora-planner.visionBoardPdf.v1';
const VISION_NAME_KEY = 'nora-planner.visionBoardName.v1';

const DEFAULT_DAILY_MINS = 9 * 60;

const defaultSettings: AppSettings = {
  defaultDailyCapacityMinutes: DEFAULT_DAILY_MINS,
  weekStartsOn: 0,
  weekdayCapacityMinutes: Array(7).fill(DEFAULT_DAILY_MINS),
  bufferMinutesBetweenTasks: 0,
  capacityWarningThreshold: 90,
  waterDailyGoalOz: 90,
  calorieDailyGoal: 2000,
};

function migrateSettings(parsed: Partial<AppSettings> | undefined): AppSettings {
  const merged: AppSettings = { ...defaultSettings, ...(parsed ?? {}) };
  // Old persisted state may be missing weekdayCapacityMinutes — backfill it
  // from the legacy single default so the user's existing capacity is kept.
  if (
    !Array.isArray(merged.weekdayCapacityMinutes) ||
    merged.weekdayCapacityMinutes.length !== 7
  ) {
    merged.weekdayCapacityMinutes = Array(7).fill(
      merged.defaultDailyCapacityMinutes,
    );
  }
  return merged;
}

function loadPersisted(): PersistedState {
  const visionBoardPdf = (() => {
    try {
      return localStorage.getItem(VISION_PDF_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  })();
  const visionBoardName = (() => {
    try {
      return localStorage.getItem(VISION_NAME_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  })();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      return {
        tasks: parsed.tasks ?? sampleTasks,
        events: parsed.events ?? sampleEvents,
        capacityOverrides: parsed.capacityOverrides ?? [],
        manualPlacements: parsed.manualPlacements ?? {},
        completedInstances: parsed.completedInstances ?? {},
        scheduledTimes: parsed.scheduledTimes ?? {},
        settings: migrateSettings(parsed.settings),
        habits: parsed.habits ?? [],
        habitCompletions: parsed.habitCompletions ?? {},
        moodEntries: parsed.moodEntries ?? {},
        dailyMetrics: parsed.dailyMetrics ?? {},
        visionBoardPdf,
        visionBoardName,
        monthlyNotes: parsed.monthlyNotes ?? {},
        notes: parsed.notes ?? [],
        assistantCollapsed: parsed.assistantCollapsed ?? false,
      };
    }
  } catch {
    // fall through to defaults
  }
  return {
    tasks: sampleTasks,
    events: sampleEvents,
    capacityOverrides: [],
    manualPlacements: {},
    completedInstances: {},
    scheduledTimes: {},
    settings: defaultSettings,
    habits: [],
    habitCompletions: {},
    moodEntries: {},
    dailyMetrics: {},
    visionBoardPdf,
    visionBoardName,
    monthlyNotes: {},
    notes: [],
    assistantCollapsed: false,
  };
}

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(() => loadPersisted());
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [topTab, setTopTab] = useState<TopTab>('planner');
  const [anchorDate, setAnchorDate] = useState<string>(todayISO());
  const [lastCapacityOverride, setLastCapacityOverride] = useState<
    CapacityOverride | undefined
  >(undefined);

  useEffect(() => {
    try {
      // Keep the PDF and its name in their own storage keys so a large PDF
      // doesn't blow up the main state blob (and so a quota failure on the
      // PDF can't take other planner data with it).
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { visionBoardPdf, visionBoardName, ...rest } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    } catch {
      // ignore quota errors
    }
  }, [state]);

  const addTask = useCallback((t: Omit<Task, 'id' | 'createdAt'>) => {
    setState((s) => ({
      ...s,
      tasks: [
        ...s.tasks,
        {
          ...t,
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: todayISO(),
        },
      ],
    }));
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.filter((t) => t.id !== id),
      manualPlacements: Object.fromEntries(
        Object.entries(s.manualPlacements).filter(
          ([k]) => !k.startsWith(`${id}__`),
        ),
      ),
      completedInstances: Object.fromEntries(
        Object.entries(s.completedInstances).filter(
          ([k]) => !k.startsWith(`${id}__`),
        ),
      ),
      scheduledTimes: Object.fromEntries(
        Object.entries(s.scheduledTimes).filter(
          ([k]) => !k.startsWith(`${id}__`),
        ),
      ),
    }));
  }, []);

  const addEvent = useCallback((e: Omit<CalendarEvent, 'id'>) => {
    setState((s) => ({
      ...s,
      events: [
        ...s.events,
        {
          ...e,
          id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        },
      ],
    }));
  }, []);

  const updateEvent = useCallback(
    (id: string, patch: Partial<CalendarEvent>) => {
      setState((s) => ({
        ...s,
        events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }));
    },
    [],
  );

  const deleteEvent = useCallback((id: string) => {
    setState((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
  }, []);

  const setCapacityOverride = useCallback(
    (date: string, minutes: number, note?: string) => {
      const override: CapacityOverride = { date, minutes, note };
      setState((s) => {
        const others = s.capacityOverrides.filter((o) => o.date !== date);
        return { ...s, capacityOverrides: [...others, override] };
      });
      setLastCapacityOverride(override);
    },
    [],
  );

  const clearCapacityOverride = useCallback((date: string) => {
    setState((s) => ({
      ...s,
      capacityOverrides: s.capacityOverrides.filter((o) => o.date !== date),
    }));
    setLastCapacityOverride(undefined);
  }, []);

  const setManualPlacement = useCallback(
    (instanceKey: string, date: string) => {
      setState((s) => ({
        ...s,
        manualPlacements: { ...s.manualPlacements, [instanceKey]: date },
      }));
    },
    [],
  );

  const clearManualPlacement = useCallback((instanceKey: string) => {
    setState((s) => {
      const next = { ...s.manualPlacements };
      delete next[instanceKey];
      return { ...s, manualPlacements: next };
    });
  }, []);

  const setScheduledTime = useCallback(
    (instanceKey: string, time: string) => {
      setState((s) => ({
        ...s,
        scheduledTimes: { ...s.scheduledTimes, [instanceKey]: time },
      }));
    },
    [],
  );

  const clearScheduledTime = useCallback((instanceKey: string) => {
    setState((s) => {
      if (!(instanceKey in s.scheduledTimes)) return s;
      const next = { ...s.scheduledTimes };
      delete next[instanceKey];
      return { ...s, scheduledTimes: next };
    });
  }, []);

  const toggleInstanceComplete = useCallback((instanceKey: string) => {
    setState((s) => {
      const next = { ...s.completedInstances };
      if (next[instanceKey]) delete next[instanceKey];
      else next[instanceKey] = true;
      return { ...s, completedInstances: next };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const resetToSamples = useCallback(() => {
    setState({
      tasks: sampleTasks,
      events: sampleEvents,
      capacityOverrides: [],
      manualPlacements: {},
      completedInstances: {},
      scheduledTimes: {},
      settings: defaultSettings,
      habits: [],
      habitCompletions: {},
      moodEntries: {},
      dailyMetrics: {},
      monthlyNotes: {},
      notes: [],
      assistantCollapsed: false,
    });
    setLastCapacityOverride(undefined);
  }, []);

  const habitKey = (habitId: string, date: string) => `${habitId}__${date}`;

  const addHabit = useCallback((h: Omit<Habit, 'id' | 'createdAt'>) => {
    setState((s) => ({
      ...s,
      habits: [
        ...s.habits,
        {
          ...h,
          id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: todayISO(),
        },
      ],
    }));
  }, []);

  const updateHabit = useCallback((id: string, patch: Partial<Habit>) => {
    setState((s) => ({
      ...s,
      habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }));
  }, []);

  const deleteHabit = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      habits: s.habits.filter((h) => h.id !== id),
      habitCompletions: Object.fromEntries(
        Object.entries(s.habitCompletions).filter(
          ([k]) => !k.startsWith(`${id}__`),
        ),
      ),
    }));
  }, []);

  const toggleHabitCompletion = useCallback(
    (habitId: string, date: string) => {
      const key = habitKey(habitId, date);
      setState((s) => {
        const next = { ...s.habitCompletions };
        if (next[key]) delete next[key];
        else next[key] = true;
        return { ...s, habitCompletions: next };
      });
    },
    [],
  );

  const isHabitDoneOn = useCallback(
    (habitId: string, date: string) => Boolean(state.habitCompletions[habitKey(habitId, date)]),
    [state.habitCompletions],
  );

  const setMood = useCallback(
    (date: string, score: MoodScore, note?: string) => {
      setState((s) => ({
        ...s,
        moodEntries: {
          ...s.moodEntries,
          [date]: {
            date,
            score,
            note,
            createdAt: new Date().toISOString(),
          },
        },
      }));
    },
    [],
  );

  const clearMood = useCallback((date: string) => {
    setState((s) => {
      const next = { ...s.moodEntries };
      delete next[date];
      return { ...s, moodEntries: next };
    });
  }, []);

  // Daily metrics: water cup counter + calorie running total.
  const patchDailyMetrics = (
    s: PersistedState,
    date: string,
    patch: Partial<DailyMetrics>,
  ): PersistedState => {
    const prev = s.dailyMetrics[date] ?? { date };
    const next: DailyMetrics = { ...prev, ...patch, date };
    // Drop the entry entirely when both values are absent so the persisted
    // store stays small.
    const cleaned: Record<string, DailyMetrics> = { ...s.dailyMetrics };
    if ((next.waterCups ?? 0) <= 0 && (next.calories ?? 0) <= 0) {
      delete cleaned[date];
    } else {
      cleaned[date] = next;
    }
    return { ...s, dailyMetrics: cleaned };
  };

  const addWaterCup = useCallback((date: string) => {
    setState((s) => {
      const cur = s.dailyMetrics[date]?.waterCups ?? 0;
      return patchDailyMetrics(s, date, { waterCups: cur + 1 });
    });
  }, []);

  const removeWaterCup = useCallback((date: string) => {
    setState((s) => {
      const cur = s.dailyMetrics[date]?.waterCups ?? 0;
      return patchDailyMetrics(s, date, { waterCups: Math.max(0, cur - 1) });
    });
  }, []);

  const resetWater = useCallback((date: string) => {
    setState((s) => patchDailyMetrics(s, date, { waterCups: 0 }));
  }, []);

  const addCalories = useCallback((date: string, amount: number) => {
    setState((s) => {
      const cur = s.dailyMetrics[date]?.calories ?? 0;
      return patchDailyMetrics(s, date, { calories: cur + amount });
    });
  }, []);

  const setCalories = useCallback((date: string, total: number) => {
    setState((s) => patchDailyMetrics(s, date, { calories: Math.max(0, total) }));
  }, []);

  const resetCalories = useCallback((date: string) => {
    setState((s) => patchDailyMetrics(s, date, { calories: 0 }));
  }, []);

  // Vision board — separate localStorage key so we can fail loudly when the
  // browser refuses to store a large PDF instead of silently truncating.
  const setVisionBoard = useCallback(
    (dataUrl: string, name: string): boolean => {
      try {
        localStorage.setItem(VISION_PDF_KEY, dataUrl);
        localStorage.setItem(VISION_NAME_KEY, name);
        setState((s) => ({ ...s, visionBoardPdf: dataUrl, visionBoardName: name }));
        return true;
      } catch (err) {
        console.warn('[vision board] failed to persist PDF:', err);
        return false;
      }
    },
    [],
  );

  const clearVisionBoard = useCallback(() => {
    try {
      localStorage.removeItem(VISION_PDF_KEY);
      localStorage.removeItem(VISION_NAME_KEY);
    } catch {
      // ignore
    }
    setState((s) => ({ ...s, visionBoardPdf: undefined, visionBoardName: undefined }));
  }, []);

  // Monthly notes (one persistent textarea per "YYYY-MM").  Empty strings
  // are dropped to keep the persisted store small.
  const setMonthlyNote = useCallback((monthKey: string, text: string) => {
    setState((s) => {
      const next = { ...s.monthlyNotes };
      if (text.trim()) next[monthKey] = text;
      else delete next[monthKey];
      return { ...s, monthlyNotes: next };
    });
  }, []);

  // Sticky notes — colors cycle through the available palette so each new
  // note looks visibly different by default.
  const NOTE_COLOR_CYCLE: NoteColor[] = [
    'lavender',
    'sage',
    'sky',
    'rose',
    'clay',
  ];

  const addNote = useCallback(
    (n?: Partial<Pick<Note, 'content' | 'color'>>) => {
      const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();
      setState((s) => {
        const color =
          n?.color ?? NOTE_COLOR_CYCLE[s.notes.length % NOTE_COLOR_CYCLE.length];
        const note: Note = {
          id,
          content: n?.content ?? '',
          color,
          createdAt: now,
          updatedAt: now,
        };
        return { ...s, notes: [note, ...s.notes] };
      });
      return id;
    },
    [],
  );

  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<Note, 'content' | 'color'>>) => {
      const now = new Date().toISOString();
      setState((s) => ({
        ...s,
        notes: s.notes.map((n) =>
          n.id === id ? { ...n, ...patch, updatedAt: now } : n,
        ),
      }));
    },
    [],
  );

  const deleteNote = useCallback((id: string) => {
    setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
  }, []);

  const toggleAssistantCollapsed = useCallback(() => {
    setState((s) => ({ ...s, assistantCollapsed: !s.assistantCollapsed }));
  }, []);

  const habitCompletionsList: HabitCompletion[] = useMemo(
    () =>
      Object.keys(state.habitCompletions).map((k) => {
        const [habitId, date] = k.split('__');
        return { habitId, date };
      }),
    [state.habitCompletions],
  );

  const planArgs = {
    tasks: state.tasks,
    events: state.events,
    capacityOverrides: state.capacityOverrides,
    manualPlacements: state.manualPlacements,
    completedInstances: state.completedInstances,
    scheduledTimes: state.scheduledTimes,
    defaultDailyCapacityMinutes: state.settings.defaultDailyCapacityMinutes,
    weekdayCapacityMinutes: state.settings.weekdayCapacityMinutes,
    bufferMinutesBetweenTasks: state.settings.bufferMinutesBetweenTasks,
  };

  const weeklyPlan = useMemo(() => {
    const start = startOfWeek(anchorDate, state.settings.weekStartsOn);
    const end = addDays(start, 6);
    return planRange({ ...planArgs, rangeStart: start, rangeEnd: end });
    // planArgs is recomputed every render but its internals are state-derived;
    // depending on `state` covers the meaningful changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorDate, state]);

  const monthlyPlan = useMemo(() => {
    const start = startOfMonth(anchorDate);
    const end = endOfMonth(anchorDate);
    return planRange({ ...planArgs, rangeStart: start, rangeEnd: end });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorDate, state]);

  const quarterlyPlan = useMemo(() => {
    const start = startOfQuarter(anchorDate);
    const end = endOfMonth(addDays(start, 75));
    return planRange({ ...planArgs, rangeStart: start, rangeEnd: end });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorDate, state]);

  const value: PlannerContextValue = {
    ...state,
    viewMode,
    setViewMode,
    topTab,
    setTopTab,
    anchorDate,
    setAnchorDate,
    weeklyPlan,
    monthlyPlan,
    quarterlyPlan,
    lastCapacityOverride,
    addTask,
    updateTask,
    deleteTask,
    addEvent,
    updateEvent,
    deleteEvent,
    setCapacityOverride,
    clearCapacityOverride,
    setManualPlacement,
    clearManualPlacement,
    setScheduledTime,
    clearScheduledTime,
    toggleInstanceComplete,
    updateSettings,
    resetToSamples,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleHabitCompletion,
    isHabitDoneOn,
    setMood,
    clearMood,
    habitCompletionsList,
    addWaterCup,
    removeWaterCup,
    resetWater,
    addCalories,
    setCalories,
    resetCalories,
    setVisionBoard,
    clearVisionBoard,
    setMonthlyNote,
    addNote,
    updateNote,
    deleteNote,
    toggleAssistantCollapsed,
  };

  return (
    <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
  );
}
