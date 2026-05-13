# Nora — a calm weekly planner

A gentle, capacity-aware life planner. You set how many hours you actually
have today; Nora plans around it. Calendar events and tasks both count
against capacity, recurring chores schedule themselves, and a compassionate
assistant explains every move.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build
npm run lint         # ESLint
```

The MVP runs entirely in-browser with `localStorage` persistence and seeded
sample data.

## Deployment

The frontend deploys to Vercel as a static site; the AI endpoints
(`/api/assistant`, `/api/insights`, `/api/health`) live in `api/` as Vercel
serverless functions. Local development still uses the Express server in
`server/` via Vite's proxy — the two implementations are kept in sync by hand.

To deploy:

1. Push the repo to GitHub.
2. In Vercel, import the repo (defaults are correct — framework: Vite).
3. Add an env var: `ANTHROPIC_API_KEY` = (your Anthropic key).
4. Optional: `ANTHROPIC_MODEL` = `claude-haiku-4-5-20251001` (already the default).

Vercel auto-builds on every push to `main`.

## Architecture

```
src/
  types/            domain types (Task, CalendarEvent, PlanResult, …)
  data/             mock seed data (tasks + "Google Calendar" events)
  lib/
    dates.ts        ISO-date helpers (no UTC round-trips)
    recurrence.ts   expand recurring tasks into instances within a range
    planner.ts      pure planning engine (capacity-aware auto-scheduler)
    assistant.ts    plain-English summaries from a PlanResult
    nlp.ts          rule-based "natural-ish language" task parser
  state/
    PlannerContext.tsx     provider + reducers (localStorage backed)
    plannerContextValue.ts context type + createContext
    usePlanner.ts          consumer hook
  components/
    layout/Header.tsx      top bar + view toggle + week navigation
    assistant/AssistantPanel.tsx   right sidebar
    views/
      WeeklyView.tsx       primary detailed planner with drag-and-drop
      MonthlyView.tsx      month grid with busy indicators
      QuarterlyView.tsx    3-month view with monthly/quarterly markers
    tasks/
      TaskBlock.tsx        movable / fixed block
      TaskIntake.tsx       chat-style + form intake
      TaskDetailModal.tsx  click-through inspector
    DayColumn.tsx          weekly day with capacity bar + drop zone
    CapacityBar.tsx        gentle "x.xh / yh" indicator
    CapacityModal.tsx      "How are you feeling today?" override
    icons.tsx              inline SVG icons (no extra dep)
```

## Planning algorithm (high level)

`lib/planner.ts:planRange` is pure. It:

1. Seeds each day with capacity (override > default).
2. Places fixed `CalendarEvent`s first.
3. Expands recurring + one-time tasks into instances.
4. Honors any `manualPlacements` (drag-and-drop).
5. Sorts remaining instances: non-negotiable → deadline urgency → big rocks first.
6. Places each instance on its preferred day if it fits; otherwise searches
   nearby days. Splittable tasks fill capacity and carry the remainder forward.
7. Whatever still doesn't fit becomes `unplaced` with a friendly reason.
8. Manual placements may overload a day on purpose — the day is visually
   flagged, but Nora doesn't re-shuffle the user's explicit choice.

## Capacity adjustments

`Heart` icon on any day column or "Adjust today's capacity" in the assistant
sidebar opens the override modal. Set today's capacity to e.g. 4h and Nora
keeps non-negotiable items pinned and pushes negotiable ones forward.

## Google Calendar (placeholder)

`mockData.ts` produces `CalendarEvent`s with `source: 'mock'`. The planner
treats events as fixed blocks; swapping in real Google data only requires
fetching events into the `events` array — the rest of the pipeline is unchanged.

## Persistence

All state is JSON-serialized to `localStorage` under
`nora-planner.v1`. Use the "Reset to sample data" button in the assistant
panel to wipe and restart from the seeds.

## Adding your own task types

Add a row to `sampleTasks` (or use the in-app intake) with:
- `kind: 'recurring' | 'one-time'`
- `recurrence: { frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'daily', dayOfWeek?, dayOfMonth? }`
- `priority: 'non-negotiable' | 'negotiable'`
- `splittable: true` if it can be broken into chunks (set `minBlockMinutes`).

That's the whole contract — the planner and views pick it up automatically.
