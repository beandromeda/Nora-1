import { useState } from 'react';
import clsx from 'clsx';
import { usePlanner } from '../../state/usePlanner';
import {
  callAssistant,
  dispatchActions,
  type DispatchResult,
} from '../../lib/assistantClient';
import { Send, Sparkles, X } from '../icons';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'reply'; reply: string; result: DispatchResult }
  | { kind: 'error'; message: string };

// Compact assistant input shown at the top of the Daily view on phones,
// where the full right-rail AssistantPanel is hidden. Reuses the same
// callAssistant + dispatchActions pipeline.
export function MobileAssistantBar() {
  const {
    tasks,
    events,
    capacityOverrides,
    settings,
    weeklyPlan,
    monthlyPlan,
    addTask,
    addEvent,
    deleteEvent,
    setCapacityOverride,
    setManualPlacement,
    toggleInstanceComplete,
  } = usePlanner();

  const [intent, setIntent] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const submit = async () => {
    const message = intent.trim();
    if (!message || status.kind === 'loading') return;
    setStatus({ kind: 'loading' });
    try {
      const { reply, actions } = await callAssistant(message, {
        tasks,
        events,
        capacityOverrides,
        settings,
        weeklyPlan,
        monthlyPlan,
      });
      const result = dispatchActions(actions, {
        addTask,
        addEvent,
        deleteEvent,
        setCapacityOverride,
        setManualPlacement,
        toggleInstanceComplete,
        events,
      });
      setStatus({ kind: 'reply', reply, result });
      setIntent('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setStatus({ kind: 'error', message: msg });
    }
  };

  const dismiss = () => setStatus({ kind: 'idle' });

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-sage-500 flex-shrink-0" />
        <input
          type="text"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask Nora…"
          disabled={status.kind === 'loading'}
          className="input flex-1 text-sm"
        />
        <button
          onClick={submit}
          disabled={!intent.trim() || status.kind === 'loading'}
          className={clsx(
            'btn flex-shrink-0',
            intent.trim() && status.kind !== 'loading'
              ? 'bg-sage-500 text-sand-50 hover:bg-sage-600'
              : 'bg-sand-200 text-ink-400 cursor-not-allowed',
          )}
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {status.kind === 'loading' && (
        <div className="text-xs text-ink-500 px-1">Thinking…</div>
      )}
      {status.kind === 'error' && (
        <ReplyShell tone="error" onDismiss={dismiss}>
          {status.message}
        </ReplyShell>
      )}
      {status.kind === 'reply' && (
        <ReplyShell
          tone={status.result.errors.length > 0 ? 'mixed' : 'good'}
          onDismiss={dismiss}
        >
          <div>{status.reply}</div>
          {status.result.applied.length > 0 && (
            <ul className="mt-1.5 list-disc list-inside text-ink-500">
              {status.result.applied.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          {status.result.errors.length > 0 && (
            <ul className="mt-1.5 list-disc list-inside text-rose-500">
              {status.result.errors.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </ReplyShell>
      )}
    </div>
  );
}

function ReplyShell({
  tone,
  onDismiss,
  children,
}: {
  tone: 'good' | 'mixed' | 'error';
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const accent =
    tone === 'good'
      ? 'bg-sage-50 text-sage-700 border-sage-200'
      : tone === 'mixed'
        ? 'bg-clay-100 text-ink-700 border-clay-200'
        : 'bg-rose-100/40 text-ink-700 border-rose-200';
  return (
    <div
      className={clsx(
        'relative text-xs leading-relaxed rounded-lg border px-3 py-2 pr-7',
        accent,
      )}
    >
      {children}
      <button
        onClick={onDismiss}
        className="absolute top-1.5 right-1.5 p-0.5 rounded hover:bg-sand-200/60 text-ink-400"
        aria-label="Dismiss"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
