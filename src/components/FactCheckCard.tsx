import { useEffect, useState } from 'react';
import type { FactCheckResult, Source } from '../types';
import { hostname } from '../lib/openai';
import { HEADING_ICON, TONE_ICON, truthTone, verdictTone } from '../lib/tone';
import { toRedditHtml, toRedditMarkdown } from '../lib/redditFormat';
import SourceModal from './SourceModal';

async function copyRich(html: string, text: string): Promise<void> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) throw new Error('copy failed');
  }
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

const CopyIcon = () => (
  <svg {...iconProps}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg {...iconProps}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function FactCheckCard({ result, streaming = false }: { result: FactCheckResult; streaming?: boolean }) {
  const [open, setOpen] = useState<Source | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (copyState === 'idle') return;
    const t = setTimeout(() => setCopyState('idle'), 2000);
    return () => clearTimeout(t);
  }, [copyState]);

  const copyReddit = () =>
    copyRich(toRedditHtml(result), toRedditMarkdown(result)).then(
      () => setCopyState('copied'),
      () => setCopyState('error'),
    );
  const byId = new Map(result.sources.map((s) => [s.id, s]));
  const hasTruth = Number.isFinite(result.truthPercentage);
  const tone = hasTruth ? truthTone(result.truthPercentage) : 'mixed';

  const renderChips = (ids: number[]) => {
    const valid = ids.map((id) => byId.get(id)).filter((s): s is Source => !!s);
    if (!valid.length) return null;
    return (
      <span className="chips">
        {valid.map((s) => (
          <button key={s.id} className="chip" onClick={() => setOpen(s)} title={s.title}>
            [{s.id}]
          </button>
        ))}
      </span>
    );
  };

  return (
    <article className={`card result tone-${tone}${streaming ? ' streaming' : ''}`} aria-busy={streaming}>
      <h2 className="result-header">
        {HEADING_ICON.titleLeft} Fact Check {HEADING_ICON.titleRight}
        {result.overallVerdict && (
          <span className={`pill tone-${verdictTone(result.overallVerdict)}`}>{result.overallVerdict}</span>
        )}
        {!streaming && (
          <button
            className={`btn btn-sm btn-icon copy-btn ${copyState}`}
            onClick={copyReddit}
            title={copyState === 'copied' ? 'Copied!' : copyState === 'error' ? 'Copy failed' : 'Copy for Reddit'}
            aria-label="Copy for Reddit"
          >
            {copyState === 'copied' ? <CheckIcon /> : <CopyIcon />}
          </button>
        )}
      </h2>

      <p className="claim">
        <strong>{HEADING_ICON.claim} Claim:</strong> {result.claim}
      </p>

      <ul className="points">
        {result.points.map((p, i) => (
          <li key={i}>
            <span className="point-icon" aria-hidden="true">
              {TONE_ICON[verdictTone(p.verdict)]}
            </span>
            <strong>“{p.statement}”:</strong>{' '}
            {p.verdict && <strong className={`verdict tone-${verdictTone(p.verdict)}`}>{p.verdict}.</strong>}{' '}
            {p.explanation}
            {renderChips(p.sourceIds)}
          </li>
        ))}
      </ul>

      {hasTruth && (
        <div className="truth">
          <div className="truth-label">
            <strong>
              {TONE_ICON[tone]} Truth percentage: {result.truthPercentage}%
            </strong>
            {result.rationale && <span> — {result.rationale}</span>}
          </div>
          <div className="meter" aria-hidden="true">
            <div className={`meter-fill tone-${tone}`} style={{ width: `${result.truthPercentage}%` }} />
          </div>
        </div>
      )}

      {result.sources.length > 0 && (
        <section className="sources">
          <h3>{HEADING_ICON.sources} Sources</h3>
          <ol>
            {result.sources.map((s) => (
              <li key={s.id}>
                <button className="source-link" onClick={() => setOpen(s)}>
                  <span className="source-badge">[{s.id}]</span>
                  <span className="source-title">{s.title}</span>
                  <span className="muted small">{s.publisher || hostname(s.url)}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <SourceModal source={open} onClose={() => setOpen(null)} />
    </article>
  );
}
