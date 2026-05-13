import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';

const tools: Anthropic.Tool[] = [
  {
    name: 'move_task',
    description:
      'Move an upcoming task instance to a different date. Use the task id from the snapshot. instance_date is the date the instance is currently scheduled for (YYYY-MM-DD); new_date is where it should go.',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        instance_date: {
          type: 'string',
          description: 'YYYY-MM-DD — the current scheduled date.',
        },
        new_date: {
          type: 'string',
          description: 'YYYY-MM-DD — the destination date.',
        },
      },
      required: ['task_id', 'instance_date', 'new_date'],
    },
  },
  {
    name: 'set_capacity',
    description:
      'Set capacity (in hours) for a specific date. Use today\'s date for "today". Reduce capacity (e.g. half default) when the user says they feel sick, tired, or want an easy day.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD' },
        hours: { type: 'number' },
        reason: {
          type: 'string',
          description: 'Short note like "Easy day" or "Sick"',
        },
      },
      required: ['date', 'hours'],
    },
  },
  {
    name: 'complete_task_instance',
    description: 'Mark a task instance as complete (checks it off for that date).',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        instance_date: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['task_id', 'instance_date'],
    },
  },
  {
    name: 'add_task',
    description:
      'Create a new task. For repeating items, use kind="recurring" and set recurrence_frequency. For one-time tasks, set kind="one-time" and optionally preferred_date or deadline.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        estimated_minutes: { type: 'number' },
        priority: {
          type: 'string',
          enum: ['negotiable', 'non-negotiable'],
        },
        kind: { type: 'string', enum: ['one-time', 'recurring'] },
        recurrence_frequency: {
          type: 'string',
          enum: [
            'daily',
            'weekdays',
            'weekends',
            'weekly',
            'biweekly',
            'monthly',
            'quarterly',
          ],
        },
        day_of_week: {
          type: 'number',
          description: '0=Sun..6=Sat (for weekly/biweekly recurrence)',
        },
        day_of_month: {
          type: 'number',
          description: '1..28 (for monthly/quarterly recurrence)',
        },
        preferred_date: { type: 'string', description: 'YYYY-MM-DD' },
        deadline: { type: 'string', description: 'YYYY-MM-DD' },
        splittable: { type: 'boolean' },
      },
      required: ['name', 'estimated_minutes', 'priority', 'kind'],
    },
  },
  {
    name: 'add_event',
    description: 'Add a fixed calendar event with a start and end timestamp.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start: {
          type: 'string',
          description: 'ISO 8601 timestamp, e.g. 2026-05-09T14:00:00',
        },
        end: { type: 'string', description: 'ISO 8601 timestamp' },
        notes: { type: 'string' },
      },
      required: ['title', 'start', 'end'],
    },
  },
  {
    name: 'delete_event',
    description: 'Remove a calendar event by its id (from the snapshot).',
    input_schema: {
      type: 'object',
      properties: {
        event_id: { type: 'string' },
      },
      required: ['event_id'],
    },
  },
];

const SYSTEM_INSTRUCTIONS = `You are Nora's planning assistant. The user is Bianca — a busy professional managing a calendar of recurring rhythms, one-time tasks, and fixed events.

Your job: read what she says, then use the available tools to make her plan match her intent. Be decisive and warm. Don't ask permission for routine changes — just do them and tell her what you did in one or two sentences.

# How to use the tools

- For task moves, find the task in the snapshot by name (case-insensitive substring is fine). Pick the *next upcoming instance* whose date is on or after today, and call move_task with that task id and instance_date.
- Resolving dates: the snapshot includes \`today\`, \`today_weekday\`, \`tomorrow\`, \`tomorrow_weekday\`, and a \`calendar_lookup\` array mapping the next 15 days to their weekday names. **Always read dates directly from this lookup — never compute weekdays yourself.** When the user says "today", use \`today\`. When they say "tomorrow", use \`tomorrow\`. When they say "Friday" or "next Monday", scan \`calendar_lookup\` for the matching weekday name and use that \`date\` field. Do not rely on your own knowledge of what day of the week any date falls on; trust the lookup.
- When she says she's sick, tired, overwhelmed, or asks for an "easy day", lower today's capacity to roughly half the default using set_capacity, and proactively move negotiable tasks scheduled today to nearby less-loaded days using move_task. Do not move non-negotiable tasks.
- When she gives explicit hours ("4 hours today"), set capacity to that exact value.
- If she asks to add something vague ("add laundry"), pick reasonable defaults: 30 minutes, priority "negotiable", kind "one-time", preferred_date today.
- If you cannot identify a specific task or date confidently, ask one short clarifying question instead of guessing.

# Tone

Warm, brief, never preachy. Use her first name occasionally but don't overdo it. Confirm what you did in plain English ("Moved laundry to tomorrow and dropped today's capacity to 4h.").

# Constraints

- Never invent task ids — only use ids that appear in the snapshot.
- Never move non-negotiable tasks unless explicitly asked by name.
- Dates are always YYYY-MM-DD. Timestamps are ISO 8601 in local time without timezone suffix.
- One snapshot is sent per request; you have no memory of previous conversations.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { message, snapshot } = (req.body ?? {}) as {
    message?: string;
    snapshot?: unknown;
  };
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' });
  }

  const snapshotJson = JSON.stringify(snapshot ?? {}, null, 2);

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_INSTRUCTIONS,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools,
      messages: [
        {
          role: 'user',
          content: `# Snapshot of Bianca's planner\n\n\`\`\`json\n${snapshotJson}\n\`\`\`\n\n# Bianca says\n\n${message}`,
        },
      ],
    });

    const replyParts: string[] = [];
    const actions: { name: string; input: Record<string, unknown> }[] = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        replyParts.push(block.text);
      } else if (block.type === 'tool_use') {
        actions.push({
          name: block.name,
          input: (block.input as Record<string, unknown>) ?? {},
        });
      }
    }

    const reply =
      replyParts.join('\n').trim() ||
      (actions.length > 0 ? 'Done.' : "I'm not sure how to help with that yet.");

    res.json({ reply, actions });
  } catch (err) {
    console.error('[api/assistant] failed:', err);
    const msg = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ error: msg });
  }
}
