import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import FactCheckCard from '../components/FactCheckCard';

export default function HistoryDetailPage() {
  const { id } = useParams();
  const { history, removeHistory } = useStore();
  const navigate = useNavigate();
  const entry = history.find((h) => h.id === id);

  if (!entry) {
    return (
      <div className="page">
        <div className="card empty">
          <p>This fact check could not be found.</p>
          <Link className="btn" to="/history">
            Back to history
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header row">
        <div>
          <Link to="/history" className="muted small">
            ← History
          </Link>
          <h1>Fact check</h1>
          <p className="muted small">
            {new Date(entry.createdAt).toLocaleString()} · {entry.model}
          </p>
        </div>
        <button
          className="btn btn-danger"
          onClick={() => {
            removeHistory(entry.id);
            navigate('/history');
          }}
        >
          Delete
        </button>
      </header>

      <div className="card original">
        <h3>Original text</h3>
        <blockquote>{entry.input}</blockquote>
      </div>

      <FactCheckCard result={entry.result} />
    </div>
  );
}
