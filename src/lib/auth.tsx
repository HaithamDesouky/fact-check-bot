import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { openedFromRecoveryLink, supabase } from './supabase';

export type AuthStatus = 'loading' | 'signed-out' | 'needs-mfa' | 'signed-in';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  recovering: boolean;
  finishRecovery: () => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function resolveStatus(session: Session | null): Promise<AuthStatus> {
  if (!session) return 'signed-out';
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return 'signed-out';
  return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2' ? 'needs-mfa' : 'signed-in';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [recovering, setRecovering] = useState(openedFromRecoveryLink);
  const finishRecovery = useCallback(() => setRecovering(false), []);

  const apply = useCallback(async (s: Session | null) => {
    setSession(s);
    setStatus(await resolveStatus(s));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
      setTimeout(() => apply(s), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [apply]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await apply(data.session);
  }, [apply]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ status, session, recovering, finishRecovery, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
