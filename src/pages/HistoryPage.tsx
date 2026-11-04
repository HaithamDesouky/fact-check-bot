import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { truthTone } from '../lib/tone';

export default function HistoryPage() {
  const { history, removeHistory, clearHistory } = useStore();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (h) => h.input.toLowerCase().includes(q) || h.result.claim.toLowerCase().includes(q),
    );
  }, [history, query]);

  return (
    <div className="page">
      <header className="page-header row">
        <div>
          <h1>History</h1>
          <p className="muted">Your previous fact checks are stored locally in this browser.</p>
        </div>
        {history.length > 0 && (
          <button
            className="btn btn-danger"
            onClick={() => confirm('Delete all fact-check history?') && clearHistory()}
          >
            Clear all
          </button>
        )}
      </header>

      {history.length === 0 ? (
        <div className="card empty">
          <p>No fact checks yet.</p>
          <Link className="btn btn-primary" to="/">
            Run your first check
          </Link>
        </div>
      ) : (
        <>
          <input
            className="search"
            type="search"
            placeholder="Search history…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="history-list">
            {filtered.map((h) => (
              <li key={h.id} className="card history-item">
                <Link to={`/history/${h.id}`} className="history-link">
                  <span className={`score tone-${truthTone(h.result.truthPercentage)}`}>
                    {h.result.truthPercentage}%
                  </span>
                  <span className="history-body">
                    <span className="history-claim">{h.result.claim}</span>
                    <span className="muted small">
                      {h.result.overallVerdict} · {new Date(h.createdAt).toLocaleString()} · {h.model}
                    </span>
                  </span>
                </Link>
                <button className="icon-btn" aria-label="Delete" title="Delete" onClick={() => removeHistory(h.id)}>
                  🗑
                </button>
              </li>
            ))}
            {filtered.length === 0 && <p className="muted">No matches for “{query}”.</p>}
          </ul>
        </>
      )}
    </div>
  );
}
