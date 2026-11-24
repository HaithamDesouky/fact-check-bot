import type { FactCheckResult, Source } from '../types';
import { HEADING_ICON, TONE_ICON, truthTone, verdictTone } from './tone';
import { hostname, isSafeUrl } from './openai';

function escapeLinkText(s: string): string {
  return s.replace(/([[\]\\])/g, '\\$1');
}

function escapeUrl(url: string): string {
  return url.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function prepare(r: FactCheckResult) {
  const sources = r.sources.filter((s) => isSafeUrl(s.url));
  const byId = new Map(sources.map((s) => [s.id, s]));
  const refs = (ids: number[]) => ids.map((id) => byId.get(id)).filter((s): s is Source => !!s);
  return {
    sources,
    refs,
    truthIcon: TONE_ICON[truthTone(r.truthPercentage)],
    pointIcon: (verdict: string) => TONE_ICON[verdictTone(verdict)],
  };
}

export function toRedditMarkdown(r: FactCheckResult): string {
  const { sources, refs, truthIcon, pointIcon } = prepare(r);
  const cite = (ids: number[]) =>
    refs(ids)
      .map((s) => `[[${s.id}]](${escapeUrl(s.url)})`)
      .join(' ');

  const lines: string[] = [];
  lines.push(`**${HEADING_ICON.titleLeft} Fact Check ${HEADING_ICON.titleRight}**`, '');
  lines.push(`**${HEADING_ICON.claim} Claim:** ${r.claim}`, '');

  for (const p of r.points) {
    const c = cite(p.sourceIds);
    lines.push(`* ${pointIcon(p.verdict)} **“${p.statement}”:** **${p.verdict}.** ${p.explanation}${c ? ' ' + c : ''}`);
  }
  lines.push('');
  lines.push(`**${truthIcon} Truth percentage: ${r.truthPercentage}%**${r.rationale ? ` — ${r.rationale}` : ''}`);

  if (sources.length) {
    lines.push('', `**${HEADING_ICON.sources} Sources:**`, '');
    for (const s of sources) {
      lines.push(`${s.id}. [${escapeLinkText(s.title)}](${escapeUrl(s.url)}) — ${s.publisher || hostname(s.url)}`);
    }
  }

  return lines.join('\n');
}

export function toRedditHtml(r: FactCheckResult): string {
  const { sources, refs, truthIcon, pointIcon } = prepare(r);
  const e = escapeHtml;
  const cite = (ids: number[]) =>
    refs(ids)
      .map((s) => `<a href="${e(s.url)}">[${s.id}]</a>`)
      .join(' ');

  const parts: string[] = [];
  parts.push(`<p><strong>${HEADING_ICON.titleLeft} Fact Check ${HEADING_ICON.titleRight}</strong></p>`);
  parts.push(`<p><strong>${HEADING_ICON.claim} Claim:</strong> ${e(r.claim)}</p>`);
  parts.push('<ul>');
  for (const p of r.points) {
    const c = cite(p.sourceIds);
    parts.push(
      `<li>${pointIcon(p.verdict)} <strong>“${e(p.statement)}”:</strong> <strong>${e(p.verdict)}.</strong> ${e(p.explanation)}${c ? ' ' + c : ''}</li>`,
    );
  }
  parts.push('</ul>');
  parts.push(
    `<p><strong>${truthIcon} Truth percentage: ${r.truthPercentage}%</strong>${r.rationale ? ` — ${e(r.rationale)}` : ''}</p>`,
  );
  if (sources.length) {
    parts.push(`<p><strong>${HEADING_ICON.sources} Sources:</strong></p><ol>`);
    for (const s of sources) {
      parts.push(`<li><a href="${e(s.url)}">${e(s.title)}</a> — ${e(s.publisher || hostname(s.url))}</li>`);
    }
    parts.push('</ol>');
  }
  return parts.join('');
}
