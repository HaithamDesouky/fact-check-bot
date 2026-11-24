import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

type Mode = 'sign-in' | 'sign-up' | 'forgot';

const TITLES: Record<Mode, string> = {
  'sign-in': 'Sign in',
  'sign-up': 'Create an account',
  forgot: 'Reset your password',
};

export default function LoginPage() {
  const { status } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (status === 'signed-in' || status === 'needs-mfa') return <Navigate to={from} replace />;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'sign-up') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setNotice('Check your email for a confirmation link, then sign in.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice('If an account exists for that email, a reset link is on its way.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="card form auth-card" onSubmit={submit}>
        <header className="page-header">
          <span className="brand">
            <span className="brand-icon">🔎</span>
            <span>FactCheck Bot</span>
          </span>
          <h1>{TITLES[mode]}</h1>
        </header>

        {error && <div className="alert alert-error">{error}</div>}
        {notice && <div className="alert alert-warn">{notice}</div>}

        <label className="field">
          <span className="field-label">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>

        {mode !== 'forgot' && (
          <label className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              minLength={mode === 'sign-up' ? 8 : undefined}
              required
            />
          </label>
        )}

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'forgot' ? 'Send reset link' : TITLES[mode]}
        </button>

        <div className="auth-links small">
          {mode === 'sign-in' ? (
            <>
              <button type="button" className="link-btn" onClick={() => switchMode('sign-up')}>
                Create an account
              </button>
              <button type="button" className="link-btn" onClick={() => switchMode('forgot')}>
                Forgot password?
              </button>
            </>
          ) : (
            <button type="button" className="link-btn" onClick={() => switchMode('sign-in')}>
              ← Back to sign in
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
