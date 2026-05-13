import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { usePlanner } from '../../state/usePlanner';
import {
  buildAssistantMessages,
  planSummary,
  type AssistantMessage,
} from '../../lib/assistant';
import {
  callAssistant,
  dispatchActions,
  type DispatchResult,
} from '../../lib/assistantClient';
import { TaskIntake } from '../tasks/TaskIntake';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Heart,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
} from '../icons';
import { CapacityModal } from '../CapacityModal';
import { todayISO } from '../../lib/dates';

type IntentStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'reply'; reply: string; result: DispatchResult }
  | { kind: 'error'; message: string };

export function AssistantPanel() {
  const planner = usePlanner();
  const {
    weeklyPlan,
    monthlyPlan,
    quarterlyPlan,
    viewMode,
    tasks,
    events,
    capacityOverrides,
    lastCapacityOverride,
    settings,
    addTask,
    addEvent,
    deleteEvent,
    setManualPlacement,
    setCapacityOverride,
    toggleInstanceComplete,
    resetToSamples,
    assistantCollapsed,
    toggleAssistantCollapsed,
  } = planner;

  // Collapsed: render a thin rail with an icon + expand button.
  if (assistantCollapsed) {
    return (
      <aside className="w-12 flex-shrink-0 bg-sand-100 border-l border-sand-200 flex flex-col items-center py-3 gap-3 h-full">
        <button
          onClick={toggleAssistantCollapsed}
          className="p-1.5 rounded-md text-ink-500 hover:text-ink-900 hover:bg-sand-200"
          title="Expand assistant"
          aria-label="Expand assistant"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div
          className="w-8 h-8 rounded-lg bg-sage-500 text-sand-50 grid place-items-center shadow-soft"
          title="Assistant (click to expand)"
          onClick={toggleAssistantCollapsed}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleAssistantCollapsed();
            }
          }}
        >
          <Sparkles className="w-4 h-4" />
        </div>
      </aside>
    );
  }

  const plan =
    viewMode === 'weekly'
      ? weeklyPlan
      : viewMode === 'monthly'
        ? monthlyPlan
        : quarterlyPlan;

  const messages = useMemo(
    () =>
      buildAssistantMessages({
        plan,
        tasks,
        capacityOverrides,
        recentOverride: lastCapacityOverride,
      }),
    [plan, tasks, capacityOverrides, lastCapacityOverride],
  );

  const [intakeOpen, setIntakeOpen] = useState(false);
  const [capacityDate, setCapacityDate] = useState<string | null>(null);
  const [intent, setIntent] = useState('');
  const [status, setStatus] = useState<IntentStatus>({ kind: 'idle' });

  const submitIntent = async () => {
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
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus({ kind: 'error', message });
    }
  };

  return (
    <aside className="w-[360px] flex-shrink-0 bg-sand-100 border-l border-sand-200 flex flex-col h-full">
      <div className="px-5 py-4 border-b border-sand-200">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sage-500" />
            <div className="font-display text-lg text-ink-900">Assistant</div>
          </div>
          <button
            onClick={toggleAssistantCollapsed}
            className="p-1 rounded-md text-ink-400 hover:text-ink-900 hover:bg-sand-200"
            title="Collapse assistant"
            aria-label="Collapse assistant"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-ink-500 mt-1">{planSummary(plan)}</p>
      </div>

      <div className="px-5 py-4 border-b border-sand-200 space-y-2">
        <label className="label">Ask me to do something</label>
        <div className="relative">
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitIntent();
              }
            }}
            placeholder={'e.g. "I\'m feeling sick — move my negotiable tasks"\nor "Add a 30-min walk every Monday"'}
            rows={3}
            disabled={status.kind === 'loading'}
            className="input w-full resize-none pr-10 text-sm leading-relaxed"
          />
          <button
            onClick={submitIntent}
            disabled={!intent.trim() || status.kind === 'loading'}
            className={clsx(
              'absolute bottom-2 right-2 p-1.5 rounded-md transition-colors',
              intent.trim() && status.kind !== 'loading'
                ? 'bg-sage-500 text-sand-50 hover:bg-sage-600'
                : 'bg-sand-100 text-ink-300 cursor-not-allowed',
            )}
            title="Send (Enter)"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        <StatusCard status={status} />

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setIntakeOpen(true)}
            className="btn-soft flex-1 justify-center text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add task
          </button>
          <button
            onClick={() => setCapacityDate(todayISO())}
            className="btn-soft flex-1 justify-center text-xs"
          >
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            Today's capacity
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.map((m) => (
          <MessageCard key={m.id} message={m} />
        ))}
      </div>

      <div className="px-5 py-3 border-t border-sand-200">
        <button
          onClick={() => {
            if (
              confirm(
                'Reset all tasks, events, and capacity overrides back to the demo data?',
              )
            ) {
              resetToSamples();
            }
          }}
          className="btn-ghost w-full text-xs justify-start text-ink-400"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset to sample data
        </button>
      </div>

      <TaskIntake open={intakeOpen} onClose={() => setIntakeOpen(false)} />
      <CapacityModal
        date={capacityDate}
        onClose={() => setCapacityDate(null)}
      />
    </aside>
  );
}

function StatusCard({ status }: { status: IntentStatus }) {
  if (status.kind === 'idle') return null;

  if (status.kind === 'loading') {
    return (
      <div className="text-xs leading-relaxed rounded-lg px-3 py-2 bg-sand-50 text-ink-500 border border-sand-200">
        Thinking…
      </div>
    );
  }

  if (status.kind === 'error') {
    return (
      <div className="text-xs leading-relaxed rounded-lg px-3 py-2 bg-rose-100/40 text-ink-700 border border-rose-200">
        {status.message}
      </div>
    );
  }

  const { reply, result } = status;
  const tone = result.errors.length > 0 ? 'mixed' : 'good';
  return (
    <div
      className={clsx(
        'text-xs leading-relaxed rounded-lg px-3 py-2 border',
        tone === 'good'
          ? 'bg-sage-50 text-sage-700 border-sage-200'
          : 'bg-clay-100 text-ink-700 border-clay-200',
      )}
    >
      <div>{reply}</div>
      {result.applied.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 list-disc list-inside text-ink-500">
          {result.applied.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      {result.errors.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 list-disc list-inside text-rose-500">
          {result.errors.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MessageCard({ message }: { message: AssistantMessage }) {
  const tone = message.tone;
  const accent =
    tone === 'attention'
      ? 'border-rose-200 bg-rose-100/40 text-ink-900'
      : tone === 'positive'
        ? 'border-sage-200 bg-sage-50 text-ink-900'
        : tone === 'gentle'
          ? 'border-clay-200 bg-clay-100 text-ink-900'
          : 'border-sand-200 bg-sand-50 text-ink-900';

  const iconClass =
    tone === 'attention'
      ? 'text-rose-400'
      : tone === 'positive'
        ? 'text-sage-500'
        : tone === 'gentle'
          ? 'text-clay-400'
          : 'text-sage-500';

  const Icon =
    tone === 'attention' ? AlertTriangle : tone === 'gentle' ? Heart : Sparkles;

  return (
    <div className={clsx('rounded-2xl border p-4', accent)}>
      <div className="flex items-start gap-2">
        <Icon className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', iconClass)} />
        <div>
          <div className="font-medium text-sm">{message.title}</div>
          <p className="text-sm text-ink-700 mt-1 leading-relaxed">
            {message.body}
          </p>
        </div>
      </div>
    </div>
  );
}
