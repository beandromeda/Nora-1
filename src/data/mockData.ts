// Sample seed data: a realistic mix of weekly chores, monthly admin, quarterly
// items, one-off tasks, and a few mock "Google Calendar" events. Dates are
// generated relative to today so the demo always feels fresh.

import type { CalendarEvent, Task } from '../types';
import { addDays, todayISO } from '../lib/dates';

const TODAY = todayISO();

let seq = 0;
const id = (prefix: string) => `${prefix}-${++seq}`;

export const sampleTasks: Task[] = [
  // ---------- Weekly recurring ----------
  {
    id: id('task'),
    name: 'Mop the floors',
    estimatedMinutes: 30,
    priority: 'negotiable',
    kind: 'recurring',
    recurrence: { frequency: 'weekly', dayOfWeek: 0 }, // Sunday
    splittable: false,
    notes: 'Kitchen + bathroom + entryway.',
    createdAt: TODAY,
  },
  {
    id: id('task'),
    name: 'Laundry',
    estimatedMinutes: 60,
    priority: 'negotiable',
    kind: 'recurring',
    recurrence: { frequency: 'weekly', dayOfWeek: 6 }, // Saturday
    splittable: true,
    minBlockMinutes: 20,
    notes: 'Wash, dry, fold.',
    createdAt: TODAY,
  },
  {
    id: id('task'),
    name: 'Grocery shopping',
    estimatedMinutes: 60,
    priority: 'non-negotiable',
    kind: 'recurring',
    recurrence: { frequency: 'weekly', dayOfWeek: 6 },
    splittable: false,
    createdAt: TODAY,
  },
  {
    id: id('task'),
    name: 'Tidy living room',
    estimatedMinutes: 20,
    priority: 'negotiable',
    kind: 'recurring',
    recurrence: { frequency: 'weekly', dayOfWeek: 5 },
    splittable: false,
    createdAt: TODAY,
  },
  {
    id: id('task'),
    name: 'Plan next week',
    estimatedMinutes: 30,
    priority: 'non-negotiable',
    kind: 'recurring',
    recurrence: { frequency: 'weekly', dayOfWeek: 0 },
    splittable: false,
    notes: 'Review tasks, plan upcoming week.',
    createdAt: TODAY,
  },
  {
    id: id('task'),
    name: 'Workout — strength',
    estimatedMinutes: 45,
    priority: 'non-negotiable',
    kind: 'recurring',
    recurrence: { frequency: 'weekly', dayOfWeek: 2 },
    splittable: false,
    createdAt: TODAY,
  },
  {
    id: id('task'),
    name: 'Workout — cardio',
    estimatedMinutes: 45,
    priority: 'negotiable',
    kind: 'recurring',
    recurrence: { frequency: 'weekly', dayOfWeek: 4 },
    splittable: false,
    createdAt: TODAY,
  },

  // ---------- Monthly recurring ----------
  {
    id: id('task'),
    name: 'Pay bills',
    estimatedMinutes: 45,
    priority: 'non-negotiable',
    kind: 'recurring',
    recurrence: { frequency: 'monthly', dayOfMonth: 5 },
    splittable: false,
    notes: 'Rent, utilities, credit card.',
    createdAt: TODAY,
  },
  {
    id: id('task'),
    name: 'Deep clean kitchen',
    estimatedMinutes: 90,
    priority: 'negotiable',
    kind: 'recurring',
    recurrence: { frequency: 'monthly', dayOfMonth: 15 },
    splittable: true,
    minBlockMinutes: 30,
    createdAt: TODAY,
  },
  {
    id: id('task'),
    name: 'Review budget',
    estimatedMinutes: 60,
    priority: 'non-negotiable',
    kind: 'recurring',
    recurrence: { frequency: 'monthly', dayOfMonth: 1 },
    splittable: false,
    createdAt: TODAY,
  },

  // ---------- Quarterly recurring ----------
  {
    id: id('task'),
    name: 'Quarterly financial review',
    estimatedMinutes: 120,
    priority: 'non-negotiable',
    kind: 'recurring',
    recurrence: { frequency: 'quarterly', dayOfMonth: 10 },
    splittable: true,
    minBlockMinutes: 60,
    notes: 'Investments, retirement, tax planning.',
    createdAt: TODAY,
  },
  {
    id: id('task'),
    name: 'Closet & wardrobe edit',
    estimatedMinutes: 120,
    priority: 'negotiable',
    kind: 'recurring',
    recurrence: { frequency: 'quarterly', dayOfMonth: 20 },
    splittable: true,
    minBlockMinutes: 30,
    createdAt: TODAY,
  },
  {
    id: id('task'),
    name: 'Doctor / dentist appointments',
    estimatedMinutes: 60,
    priority: 'non-negotiable',
    kind: 'recurring',
    recurrence: { frequency: 'quarterly', dayOfMonth: 25 },
    splittable: false,
    notes: 'Schedule + attend.',
    createdAt: TODAY,
  },

  // ---------- One-time ----------
  {
    id: id('task'),
    name: 'Clean garage',
    estimatedMinutes: 240,
    priority: 'negotiable',
    kind: 'one-time',
    splittable: true,
    minBlockMinutes: 60,
    deadline: addDays(TODAY, 21),
    notes: 'Sort boxes, donate, sweep.',
    createdAt: TODAY,
  },
  {
    id: id('task'),
    name: 'Renew passport',
    estimatedMinutes: 90,
    priority: 'non-negotiable',
    kind: 'one-time',
    preferredDate: addDays(TODAY, 5),
    splittable: false,
    notes: 'Photos + form + post office.',
    createdAt: TODAY,
  },
  {
    id: id('task'),
    name: 'Birthday gift for Mom',
    estimatedMinutes: 60,
    priority: 'non-negotiable',
    kind: 'one-time',
    deadline: addDays(TODAY, 10),
    splittable: false,
    createdAt: TODAY,
  },
  {
    id: id('task'),
    name: 'Read book chapter',
    estimatedMinutes: 45,
    priority: 'negotiable',
    kind: 'one-time',
    splittable: true,
    minBlockMinutes: 15,
    createdAt: TODAY,
  },
];

// Mock calendar events (placeholder for Google Calendar integration). Times
// land in the upcoming week so the demo shows fixed blocks.
function ev(dateOffset: number, startHour: number, durationMins: number, title: string): CalendarEvent {
  const date = addDays(TODAY, dateOffset);
  const start = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00`);
  const end = new Date(start.getTime() + durationMins * 60000);
  return {
    id: id('evt'),
    title,
    start: start.toISOString(),
    end: end.toISOString(),
    source: 'mock',
  };
}

export const sampleEvents: CalendarEvent[] = [
  ev(1, 9, 60, 'Team standup'),
  ev(1, 14, 90, 'Project review'),
  ev(2, 12, 60, 'Lunch with Sam'),
  ev(3, 18, 120, 'Yoga class'),
  ev(5, 10, 300, 'Weekend workshop'),
  ev(8, 9, 30, 'Dentist'),
];
