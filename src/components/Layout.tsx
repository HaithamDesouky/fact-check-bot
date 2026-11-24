import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useAuth } from '../lib/auth';

export default function Layout() {
  const { history, settings } = useStore();
  const { session, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'nav-link active' : 'nav-link');

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="topbar">
          <button
            className="burger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
          <Link to="/" className="brand" onClick={closeMenu}>
            <span className="brand-icon">🔎</span>
            <span>FactCheck Bot</span>
          </Link>
          <Link to="/" className="btn btn-primary topbar-new" onClick={closeMenu}>
            ✍️ New check
          </Link>
        </div>

        <nav id="main-nav" className={menuOpen ? 'open' : ''} onClick={closeMenu}>
          <NavLink to="/" end className={(s) => `${linkClass(s)} nav-new`}>
            <span>✍️</span> New check
          </NavLink>
          <NavLink to="/history" className={linkClass}>
            <span>🕘</span> History
            {history.length > 0 && <span className="count">{history.length}</span>}
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            <span>⚙️</span> Settings
            {!settings.apiKey && <span className="dot" title="API key missing" />}
          </NavLink>
          <button type="button" className="nav-link nav-signout" onClick={signOut}>
            <span>🚪</span> Sign out
          </button>
        </nav>

        <div className="sidebar-foot">
          <div className="account small">
            <span className="account-email muted" title={session?.user.email}>
              {session?.user.email}
            </span>
            <button type="button" className="link-btn" onClick={signOut}>
              Sign out
            </button>
          </div>
          <p className="muted small">AI fact checks can be wrong. Always review the sources.</p>
        </div>
      </aside>

      {menuOpen && <div className="nav-backdrop" onClick={closeMenu} />}

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
