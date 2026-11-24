import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

interface Enrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export default function TwoFactorSettings() {
  const { refresh } = useAuth();
  const [enabledFactorId, setEnabledFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) setError(error.message);
    else setEnabledFactorId(data.totp[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const startEnroll = () =>
    run(async () => {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.all ?? []) {
        if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setCode('');
    });

  const confirmEnroll = (e: FormEvent) => {
    e.preventDefault();
    if (!enrollment) return;
    run(async () => {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code: code.trim() });
      if (error) {
        setCode('');
        throw error;
      }
      setEnrollment(null);
      await load();
      await refresh();
    });
  };

  const cancelEnroll = () =>
    run(async () => {
      if (enrollment) await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
      setEnrollment(null);
    });

  const disable = () => {
    if (!enabledFactorId || !confirm('Turn off two-factor authentication?')) return;
    run(async () => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: enabledFactorId });
      if (error) throw error;
      await supabase.auth.refreshSession();
      await load();
      await refresh();
    });
  };

  return (
    <section className="card form">
      <div className="field">
        <span className="field-label">Two-factor authentication</span>
        <span className="muted small">
          Require a 6-digit code from an authenticator app (Google Authenticator, 1Password, Authy…) when signing in.
        </span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <span className="muted">Loading…</span>
      ) : enrollment ? (
        <form className="form" onSubmit={confirmEnroll}>
          <ol className="mfa-steps">
            <li>Scan this QR code with your authenticator app.</li>
            <li>Enter the 6-digit code it shows to finish setup.</li>
          </ol>
          <img className="mfa-qr" src={enrollment.qrCode} alt="Authenticator QR code" width={180} height={180} />
          <details>
            <summary className="small">Can't scan? Enter this key manually</summary>
            <code className="mfa-secret">{enrollment.secret}</code>
          </details>
          <input
            className="otp-input"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            aria-label="Authentication code"
            required
          />
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6}>
              Verify and enable
            </button>
            <button type="button" className="btn" onClick={cancelEnroll} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : enabledFactorId ? (
        <div className="btn-row">
          <span className="saved">✓ Enabled</span>
          <button type="button" className="btn btn-danger" onClick={disable} disabled={busy}>
            Turn off
          </button>
        </div>
      ) : (
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={startEnroll} disabled={busy}>
            Set up authenticator app
          </button>
        </div>
      )}
    </section>
  );
}
