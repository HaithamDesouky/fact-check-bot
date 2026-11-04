export type Tone = 'true' | 'false' | 'mixed' | 'unknown';

export function verdictTone(verdict: string): Tone {
  const v = verdict.toLowerCase();
  if (/(false|fake|incorrect|fabricated)/.test(v)) return 'false';
  if (/(mislead|unproven|unsupported|partly|mixed|exaggerat|lacks context|mostly false)/.test(v)) return 'mixed';
  if (/(true|correct|accurate|confirmed)/.test(v)) return 'true';
  return 'unknown';
}

/** ≥70% mostly correct, 30–69% mixed, <30% false. */
export function truthTone(pct: number): 'true' | 'false' | 'mixed' {
  if (pct >= 70) return 'true';
  if (pct >= 30) return 'mixed';
  return 'false';
}

export const TONE_ICON: Record<Tone, string> = { true: '✅', mixed: '⚠️', false: '❌', unknown: 'ℹ️' };

/** Emojis for the fixed section headings. */
export const HEADING_ICON = {
  /** The title always reads "⚠️ Fact Check 🔍", regardless of verdict. */
  titleLeft: '⚠️',
  titleRight: '🔍',
  claim: '🗣️',
  sources: '📚',
} as const;
