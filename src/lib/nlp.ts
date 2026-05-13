// Lightweight, deterministic "parse a sentence into task fields" helper.
// This is intentionally rule-based (no API call) so the MVP works fully
// offline. It feeds the chat-style intake — fields it can't infer are still
// asked of the user.

import type { Priority, RecurrenceFrequency, Task } from '../types';
import { addDays, todayISO } from './dates';

export interface ParsedTask {
  name: string;
  estimatedMinutes?: number;
  priority?: Priority;
  recurrence?: RecurrenceFrequency;
  preferredDate?: string;
  deadline?: string;
  splittable?: boolean;
  preferredDayOfWeek?: number;
  notes?: string;
  // Fields we still need from the user
  missing: Array<keyof Task>;
}

const DAY_NAMES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

export function parseTaskInput(text: string): ParsedTask {
  const t = text.trim();
  const lower = t.toLowerCase();

  const out: ParsedTask = { name: t, missing: [] };

  // Duration: "30 minutes", "2 hours", "1.5 hr", "an hour"
  const durMatch =
    lower.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b)/) ??
    lower.match(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|m\b)/);
  if (durMatch) {
    const n = parseFloat(durMatch[1]);
    const isHours = /h/.test(durMatch[2]);
    out.estimatedMinutes = Math.round(isHours ? n * 60 : n);
  } else if (/\ban hour\b/.test(lower)) {
    out.estimatedMinutes = 60;
  } else if (/half (an )?hour/.test(lower)) {
    out.estimatedMinutes = 30;
  }

  // Recurrence — check the more specific patterns first.
  if (/\bweekdays\b|every weekday|mon(day)?[- ]fri(day)?/.test(lower))
    out.recurrence = 'weekdays';
  else if (/\bweekends?\b|every weekend|sat(urday)?[- ]sun(day)?/.test(lower))
    out.recurrence = 'weekends';
  else if (/\bdaily\b|every day/.test(lower)) out.recurrence = 'daily';
  else if (/\bweekly\b|every week/.test(lower)) out.recurrence = 'weekly';
  else if (/\bbiweekly\b|every (other|2) weeks?/.test(lower))
    out.recurrence = 'biweekly';
  else if (/\bmonthly\b|every month/.test(lower)) out.recurrence = 'monthly';
  else if (/\bquarterly\b|every (3 months|quarter)/.test(lower))
    out.recurrence = 'quarterly';

  // Priority hints
  if (
    /\bmust\b|\bcritical\b|non[- ]negotiable|fixed|important/.test(lower)
  )
    out.priority = 'non-negotiable';
  else if (
    /\bsome ?time\b|\bwhenever\b|\bflexible\b|negotiable|when (i|you) can/.test(
      lower,
    )
  )
    out.priority = 'negotiable';

  // Splittable
  if (/\bsplit\b|in chunks|spread out|smaller sessions?/.test(lower))
    out.splittable = true;

  // Preferred day of week
  for (const [name, dow] of Object.entries(DAY_NAMES)) {
    const re = new RegExp(`\\bon ${name}s?\\b|\\b${name} morning\\b|\\b${name} evening\\b`);
    if (re.test(lower)) {
      out.preferredDayOfWeek = dow;
      break;
    }
  }

  // Soft deadline phrases
  if (/this week\b/.test(lower)) {
    out.deadline = addDays(todayISO(), 7);
  } else if (/this month\b/.test(lower)) {
    out.deadline = addDays(todayISO(), 30);
  } else if (/by tomorrow\b/.test(lower)) {
    out.deadline = addDays(todayISO(), 1);
  } else if (/by next week\b/.test(lower)) {
    out.deadline = addDays(todayISO(), 14);
  }

  // Trim filler words from the name
  out.name = cleanName(t);

  // Determine missing fields
  if (!out.estimatedMinutes) out.missing.push('estimatedMinutes');
  if (!out.priority) out.missing.push('priority');

  return out;
}

function cleanName(t: string): string {
  // Strip leading "I need to / I want to / Remind me to"
  return t
    .replace(/^\s*(?:i (?:need|want|have|should) to\s+|remind me to\s+|please\s+)/i, '')
    .replace(/\.$/, '')
    .trim();
}
