import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import MfaChallengePage from '../pages/MfaChallengePage';

export default function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="auth-screen">
        <div className="loading">
          <span className="spinner" /> Loading…
        </div>
      </div>
    );
  }
  if (status === 'signed-out') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (status === 'needs-mfa') return <MfaChallengePage />;
  return <Outlet />;
}
