import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { snapshot } = (req.body ?? {}) as { snapshot?: unknown };
  const snapshotJson = JSON.stringify(snapshot ?? {}, null, 2);

  try {
    const anthropic = new Anthropic({ apiKey });
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
    console.error('[api/insights] failed:', err);
    const msg = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ error: msg });
  }
}
