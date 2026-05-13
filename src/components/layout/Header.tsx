import clsx from 'clsx';

import { usePlanner } from '../../state/usePlanner';
import {
  addDays,
  formatLongDate,
  formatMonthYear,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  todayISO,
  MONTH_NAMES,
  fromISODate,
} from '../../lib/dates';
import type { TopTab, ViewMode } from '../../types';
import {
  BarChart,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Heart,
  Image,
  LayoutGrid,
  Pencil,
  Repeat,
  Settings,
  Sparkles,
} from '../icons';

const VIEW_LABELS: Record<ViewMode, string> = {
  daily: 'Day',
  weekly: 'Week',
  monthly: 'Month',
  quarterly: 'Quarter',
};

const TOP_TABS: { id: TopTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'planner', label: 'Planner', icon: LayoutGrid },
  { id: 'recurring', label: 'Recurring', icon: Repeat },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'habits', label: 'Habits', icon: Heart },
  { id: 'analytics', label: 'Analytics', icon: BarChart },
  { id: 'notes', label: 'Notes', icon: Pencil },
  { id: 'vision', label: 'Vision board', icon: Image },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Header() {
  const {
    viewMode,
    setViewMode,
    topTab,
    setTopTab,
    anchorDate,
    setAnchorDate,
    settings,
  } = usePlanner();

  const stepDays =
    viewMode === 'daily'
      ? 1
      : viewMode === 'weekly'
        ? 7
        : viewMode === 'monthly'
          ? 30
          : 90;

  const goToday = () => setAnchorDate(todayISO());
  const goPrev = () => setAnchorDate(addDays(anchorDate, -stepDays));
  const goNext = () => setAnchorDate(addDays(anchorDate, stepDays));

  const label = (() => {
    if (viewMode === 'daily') {
      return formatLongDate(anchorDate);
    }
    if (viewMode === 'weekly') {
      return `Week of ${formatLongDate(startOfWeek(anchorDate, settings.weekStartsOn))}`;
    }
    if (viewMode === 'monthly') {
      return formatMonthYear(startOfMonth(anchorDate));
    }
    const d = fromISODate(startOfQuarter(anchorDate));
    const qIdx = Math.floor(d.getMonth() / 3);
    return `Q${qIdx + 1} ${d.getFullYear()} — ${MONTH_NAMES[d.getMonth()].slice(
      0,
      3,
    )}–${MONTH_NAMES[(d.getMonth() + 2) % 12].slice(0, 3)}`;
  })();

  return (
    <header className="border-b border-sand-200 bg-sand-100/70 backdrop-blur sticky top-0 z-30">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sage-500 text-sand-50 grid place-items-center shadow-soft">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display text-2xl text-ink-900 leading-none">
              Nora
            </div>
            <div className="text-xs text-ink-500 mt-0.5">
              a calm weekly planner
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 p-1 rounded-xl bg-sand-50 border border-sand-200">
          {TOP_TABS.map(({ id, label: tabLabel, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTopTab(id)}
              className={clsx(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                topTab === id
                  ? 'bg-sand-200 text-ink-900 shadow-soft'
                  : 'text-ink-500 hover:text-ink-700',
              )}
            >
              <Icon className="w-4 h-4" />
              {tabLabel}
            </button>
          ))}
        </nav>
      </div>

      {topTab === 'planner' && (
        <div className="flex items-center justify-between gap-4 px-6 pb-3 pt-0">
          <div className="flex items-center gap-2">
            <button className="btn-ghost" onClick={goPrev} aria-label="Previous">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="btn-soft" onClick={goToday}>
              Today
            </button>
            <button className="btn-ghost" onClick={goNext} aria-label="Next">
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="text-sm text-ink-700 font-medium ml-2 min-w-[210px]">
              {label}
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-sand-50 border border-sand-200">
            {(['daily', 'weekly', 'monthly', 'quarterly'] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ' +
                  (viewMode === m
                    ? 'bg-sand-200 text-ink-900 shadow-soft'
                    : 'text-ink-500 hover:text-ink-700')
                }
              >
                {VIEW_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
