import 'dotenv/config';
// On Windows, inject the OS certificate store into Node so corporate root
// CAs (used by Master Electronics' SSL inspection) are trusted by HTTPS
// requests from the Anthropic SDK. Without this we'd see
// UNABLE_TO_GET_ISSUER_CERT_LOCALLY.
if (process.platform === 'win32') {
  // @ts-expect-error — win-ca has no types
  const winCa = (await import('win-ca')) as {
    default?: { inject: (mode: string) => void };
    inject?: (mode: string) => void;
  };
  const inject = winCa.inject ?? winCa.default?.inject;
  if (inject) inject('+');
}
import Anthropic from '@anthropic-ai/sdk';
import cors from 'cors';
import express from 'express';

const app = express();
app.use(cors());
app.use(express.json({ limit: '512kb' }));

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error(
    '\n[server] ANTHROPIC_API_KEY missing. Add it to server/.env, then restart.\n',
  );
  process.exit(1);
}

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';
const PORT = Number(process.env.PORT ?? 3001);

const anthropic = new Anthropic({ apiKey });

// ---------- Tool definitions ---------------------------------------------

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

// ---------- System prompt -------------------------------------------------

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

// ---------- Endpoint ------------------------------------------------------

interface AssistantRequest {
  message: string;
  snapshot: unknown;
}

interface AssistantAction {
  name: string;
  input: Record<string, unknown>;
}

interface AssistantResponse {
  reply: string;
  actions: AssistantAction[];
}

app.post('/api/assistant', async (req, res) => {
  const { message, snapshot } = req.body as AssistantRequest;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' });
  }

  const snapshotJson = JSON.stringify(snapshot ?? {}, null, 2);

  try {
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
    const actions: AssistantAction[] = [];
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

    const reply = replyParts.join('\n').trim() ||
      (actions.length > 0 ? 'Done.' : "I'm not sure how to help with that yet.");

    const payload: AssistantResponse = { reply, actions };
    res.json(payload);
  } catch (err) {
    console.error('[server] /api/assistant failed:', err);
    if (err instanceof Error && 'cause' in err) {
      console.error('[server] cause:', (err as { cause: unknown }).cause);
    }
    const msg = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ error: msg });
  }
});

// ---------- /api/insights -----------------------------------------------
// Plain-prose insights about habits + mood. No tool use, just a thoughtful
// reflection on patterns the user can act on.

const INSIGHTS_INSTRUCTIONS = `You are Nora's gentle, observant wellness analyst. Bianca shares her habit completions, mood check-ins, water intake, and calorie totals; you reflect back what you notice.

Tone: warm, specific, never preachy or therapist-y. You are a friend who's good with patterns. Use her first name occasionally.

Structure your reply as 3-5 short paragraphs:
1. **What stood out** — the most interesting pattern you noticed (positive or otherwise)
2. **Habit pulse** — which habits are sticking, which are slipping, and any visible correlations between habits and mood
3. **Mood thread** — what the mood data is saying (averages, dips, recoveries). Reference specific dates only if they're meaningful.
4. **Body basics** — only if water and/or calorie data is present in the snapshot: how she's tracking against her water goal and what her calorie intake looks like. Skip this section if there is no wellness data.
5. **One small suggestion** — a single specific, kind thing she could try this week. Not a prescription.

Hard rules:
- Never claim things the data doesn't show.
- Don't moralize about missed habits — frame slips as data, not failure.
- Don't make medical claims or diagnose anything.
- Keep total length under 250 words.
- Use plain Markdown for emphasis (bold, italics). No headers, no lists unless one bullet group of 2-3 items maximum.`;

app.post('/api/insights', async (req, res) => {
  const { snapshot } = req.body as { snapshot: unknown };
  const snapshotJson = JSON.stringify(snapshot ?? {}, null, 2);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: [
        {
          type: 'text',
          text: INSIGHTS_INSTRUCTIONS,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Here's the data:\n\n\`\`\`json\n${snapshotJson}\n\`\`\`\n\nGive me your reflection.`,
        },
      ],
    });

    const replyParts: string[] = [];
    for (const block of response.content) {
      if (block.type === 'text') replyParts.push(block.text);
    }
    res.json({ reply: replyParts.join('\n').trim() });
  } catch (err) {
    console.error('[server] /api/insights failed:', err);
    const msg = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: MODEL });
});

app.listen(PORT, () => {
  console.log(`[server] Nora assistant listening on http://localhost:${PORT}`);
  console.log(`[server] Model: ${MODEL}`);
});
