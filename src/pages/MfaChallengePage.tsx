import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default function MfaChallengePage() {
  const { refresh, signOut } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (error) return setError(error.message);
      const factor = data.totp[0];
      if (factor) setFactorId(factor.id);
      else setError('No authenticator app found on this account.');
    });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (error) {
      setError(error.message);
      setCode('');
      return;
    }
    await refresh();
  };

  return (
    <div className="auth-screen">
      <form className="card form auth-card" onSubmit={submit}>
        <header className="page-header">
          <h1>Two-factor authentication</h1>
          <p className="muted">Enter the 6-digit code from your authenticator app.</p>
        </header>

        {error && <div className="alert alert-error">{error}</div>}

        <input
          className="otp-input"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          aria-label="Authentication code"
          autoFocus
          required
        />

        <button type="submit" className="btn btn-primary" disabled={busy || !factorId || code.length !== 6}>
          {busy ? 'Verifying…' : 'Verify'}
        </button>

        <div className="auth-links small">
          <button type="button" className="link-btn" onClick={signOut}>
            Use a different account
          </button>
        </div>
      </form>
    </div>
  );
}
