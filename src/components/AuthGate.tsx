import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Sparkles } from './icons';

interface Props {
  children: (session: Session) => ReactNode;
}

/**
 * Renders the planner only when a Supabase session exists. Otherwise shows a
 * magic-link login screen.  The planner is rendered as a children-callback so
 * downstream code receives a guaranteed-non-null session.
 */
export function AuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <Splash message="Loading…" />;
  if (!session) return <LoginScreen />;
  return <>{children(session)}</>;
}

function Splash({ message }: { message: string }) {
  return (
    <div className="h-screen grid place-items-center bg-sand-50">
      <div className="flex flex-col items-center gap-3 text-ink-500">
        <div className="w-12 h-12 rounded-2xl bg-sage-500 text-sand-50 grid place-items-center shadow-soft">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="text-sm">{message}</div>
      </div>
    </div>
  );
}

type LoginStatus =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<LoginStatus>({ kind: 'idle' });

  const sendMagicLink = async () => {
    const value = email.trim();
    if (!value) return;
    setStatus({ kind: 'sending' });
    const { error } = await supabase.auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setStatus({ kind: 'error', message: error.message });
    } else {
      setStatus({ kind: 'sent', email: value });
    }
  };

  return (
    <div className="h-screen grid place-items-center bg-sand-50 px-4">
      <div className="card p-6 sm:p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-sage-500 text-sand-50 grid place-items-center shadow-soft">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display text-2xl text-ink-900 leading-none">
              Welcome to Nora
            </div>
            <div className="text-xs text-ink-500 mt-1">
              your calm weekly planner
            </div>
          </div>
        </div>

        {status.kind === 'sent' ? (
          <div className="space-y-2">
            <p className="text-sm text-ink-700">
              Check <span className="font-medium">{status.email}</span> for a
              sign-in link from Supabase. Tap it on this device to come back
              here logged in.
            </p>
            <button
              onClick={() => setStatus({ kind: 'idle' })}
              className="text-xs text-ink-400 hover:text-ink-700 underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMagicLink();
            }}
            className="space-y-3"
          >
            <p className="text-sm text-ink-500 leading-relaxed">
              Sign in with your email — we'll send you a one-click magic link.
              No password to remember.
            </p>
            <label className="label" htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={status.kind === 'sending'}
              className="input w-full"
            />
            <button
              type="submit"
              disabled={!email.trim() || status.kind === 'sending'}
              className={clsx(
                'btn w-full justify-center',
                email.trim() && status.kind !== 'sending'
                  ? 'bg-sage-500 text-sand-50 hover:bg-sage-600'
                  : 'bg-sand-200 text-ink-400 cursor-not-allowed',
              )}
            >
              {status.kind === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {status.kind === 'error' && (
              <div className="text-xs text-rose-500 bg-rose-100/40 border border-rose-200 rounded-lg px-3 py-2">
                {status.message}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
