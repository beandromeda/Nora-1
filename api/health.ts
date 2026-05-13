import type { VercelRequest, VercelResponse } from '@vercel/node';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.json({ ok: true, model: MODEL });
}
