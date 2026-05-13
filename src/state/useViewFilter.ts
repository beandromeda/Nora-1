import { useEffect, useMemo, useState } from 'react';

import type { ScheduledBlock, Task } from '../types';

// Four user-facing buckets shown on the monthly/quarterly views. Daily,
// weekly, and biweekly recurrences all roll up to "recurring-weekly" so the
// filter UI stays simple. Events covers both calendar events and one-time
// tasks.
export type ViewCategory =
  | 'recurring-weekly'
  | 'recurring-monthly'
  | 'recurring-quarterly'
  | 'event';

export const ALL_CATEGORIES: ViewCategory[] = [
  'recurring-weekly',
  'recurring-monthly',
  'recurring-quarterly',
  'event',
];

export const CATEGORY_LABELS: Record<ViewCategory, string> = {
  'recurring-weekly': 'Recurring weekly',
  'recurring-monthly': 'Recurring monthly',
  'recurring-quarterly': 'Recurring quarterly',
  event: 'Events',
};

export function categoryForBlock(
  block: ScheduledBlock,
  taskById: Map<string, Task>,
): ViewCategory {
  if (block.kind === 'event') return 'event';
  const task = block.taskId ? taskById.get(block.taskId) : undefined;
  if (!task || task.kind !== 'recurring') return 'event';
  const freq = task.recurrence?.frequency;
  if (freq === 'monthly') return 'recurring-monthly';
  if (freq === 'quarterly') return 'recurring-quarterly';
  return 'recurring-weekly';
}

export function categoryForTask(task: Task): ViewCategory {
  if (task.kind !== 'recurring') return 'event';
  const freq = task.recurrence?.frequency;
  if (freq === 'monthly') return 'recurring-monthly';
  if (freq === 'quarterly') return 'recurring-quarterly';
  return 'recurring-weekly';
}

// v2 bumped when defaults changed (monthly→only monthly, quarterly→only
// quarterly). Old v1 values were "show everything" and would mask the new
// defaults if reused.
const STORAGE_PREFIX = 'nora-planner.view-filter.v2.';

export function useViewFilter(
  viewKey: 'monthly' | 'quarterly',
  defaults: ViewCategory[] = ALL_CATEGORIES,
) {
  const storageKey = STORAGE_PREFIX + viewKey;
  const [active, setActive] = useState<Set<ViewCategory>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const arr = JSON.parse(raw) as ViewCategory[];
        const filtered = arr.filter((c) =>
          (ALL_CATEGORIES as string[]).includes(c),
        ) as ViewCategory[];
        return new Set(filtered);
      }
    } catch {
      // ignore parse/storage errors
    }
    return new Set(defaults);
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...active]));
    } catch {
      // ignore quota errors
    }
  }, [storageKey, active]);

  const toggle = (cat: ViewCategory) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  const setAll = () => setActive(new Set(ALL_CATEGORIES));
  const setOnly = (cat: ViewCategory) => setActive(new Set([cat]));
  const reset = () => setActive(new Set(defaults));

  const allOn = useMemo(
    () => ALL_CATEGORIES.every((c) => active.has(c)),
    [active],
  );

  return { active, toggle, setAll, setOnly, reset, allOn };
}
