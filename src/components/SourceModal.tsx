import { useEffect, useRef } from 'react';
import type { Source } from '../types';
import { hostname, isSafeUrl } from '../lib/openai';

interface Props {
  source: Source | null;
  onClose: () => void;
}

export default function SourceModal({ source, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!source) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [source, onClose]);

  if (!source) return null;
  const safe = isSafeUrl(source.url);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="source-badge">[{source.id}]</span>
          <span className="modal-publisher">{source.publisher || hostname(source.url)}</span>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <h2 id="source-title" className="modal-title">
          {source.title}
        </h2>
        {source.summary ? (
          <p className="modal-summary">{source.summary}</p>
        ) : (
          <p className="modal-summary muted">No summary available for this source.</p>
        )}
        <div className="modal-link">
          <span className="muted small">{source.url}</span>
          {safe && (
            <a className="btn btn-primary" href={source.url} target="_blank" rel="noopener noreferrer">
              Open source ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
