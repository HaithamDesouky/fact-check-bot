import type { FactCheckResult, Settings, Source } from '../types';
import { parsePartialJson } from './partialJson';

const ENDPOINT = 'https://api.openai.com/v1/responses';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['claim', 'overallVerdict', 'points', 'truthPercentage', 'rationale', 'sources'],
  properties: {
    claim: {
      type: 'string',
      description: 'A concise one-sentence restatement of the main claim(s) in the text, quoting key phrases.',
    },
    overallVerdict: {
      type: 'string',
      enum: ['True', 'Mostly true', 'Mixed', 'Misleading', 'Mostly false', 'False', 'Unverifiable'],
    },
    points: {
      type: 'array',
      description: 'Each distinct sub-claim checked individually.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['statement', 'verdict', 'explanation', 'sourceIds'],
        properties: {
          statement: { type: 'string', description: 'Short quote of the sub-claim.' },
          verdict: {
            type: 'string',
            description: 'Short verdict label, e.g. "True", "False / unsupported", "Misleading / unproven".',
          },
          explanation: {
            type: 'string',
            description: '1-3 sentences explaining the verdict. Do not include citation markers.',
          },
          sourceIds: {
            type: 'array',
            items: { type: 'integer' },
            description: 'ids of sources (from the sources array) supporting this explanation.',
          },
        },
      },
    },
    truthPercentage: { type: 'integer', minimum: 0, maximum: 100 },
    rationale: {
      type: 'string',
      description: 'One short phrase explaining the truth percentage, e.g. "based on unverified allegations presented as established facts."',
    },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'publisher', 'url', 'summary'],
        properties: {
          id: { type: 'integer', description: 'Sequential id starting at 1.' },
          title: { type: 'string' },
          publisher: { type: 'string', description: 'Site or outlet name, e.g. "Reuters".' },
          url: { type: 'string' },
          summary: { type: 'string', description: '2-3 sentence summary of what this source says relevant to the claim.' },
        },
      },
    },
  },
} as const;

function instructions(webSearch: boolean, maxWords: number, language: string, maxSources: number): string {
  const today = new Date().toISOString().slice(0, 10);
  const lengthRule =
    maxWords > 0
      ? `LENGTH LIMIT: the combined word count of claim, every point's statement + verdict + explanation, and rationale MUST NOT exceed ${maxWords} words in total. Merge or drop minor sub-claims and shorten explanations to fit. Source summaries do not count toward this limit but keep each under 60 words.`
      : '';
  return [
    `You are a rigorous, neutral fact-checker. Today's date is ${today}.`,
    'The user will paste text such as a social media comment, post or article excerpt.',
    'Identify the main factual claim(s), split them into distinct sub-claims, and assess each one.',
    webSearch
      ? 'Use web search to find reputable, current sources (fact-checkers, major news outlets, official records). Only cite URLs you actually found.'
      : 'You do not have web access. Only cite sources you are highly confident exist with accurate URLs; if unsure, cite fewer sources and say evidence could not be verified.',
    `Cite AT MOST ${maxSources} source${maxSources === 1 ? '' : 's'} in total. Prefer the most authoritative ones.`,
    'Distinguish between "false", "unproven/unsupported", and "misleading" carefully. Do not overstate certainty.',
    'If the text contains opinions rather than factual claims, say so and use the verdict "Unverifiable".',
    'truthPercentage is your estimate of how much of the text is factually accurate (0 = entirely false, 100 = entirely accurate).',
    language
      ? `Write ALL text fields (claim, statements, verdicts, explanations, rationale, source summaries) in ${language}, regardless of the language of the user text. Translate quoted claims into ${language}. Keep source titles in their original language. The overallVerdict field must stay one of its fixed English enum values.`
      : 'Respond in the same language as the user text.',
    lengthRule,
  ]
    .filter(Boolean)
    .join('\n');
}

interface Annotation {
  type: string;
  url?: string;
  title?: string;
}

interface ResponsesOutputItem {
  type: string;
  content?: { type: string; text?: string; annotations?: Annotation[] }[];
}

interface StreamEvent {
  type: string;
  delta?: string;
  message?: string;
  response?: { output?: ResponsesOutputItem[]; error?: { message?: string }; incomplete_details?: { reason?: string } };
}

export class OpenAIError extends Error {}

export type FactCheckStatus = 'searching' | 'writing';

export interface FactCheckOptions {
  maxWords?: number;
  language?: string;
  signal?: AbortSignal;
  onPartial?: (partial: FactCheckResult) => void;
  onStatus?: (status: FactCheckStatus) => void;
}

function fillPartial(raw: Partial<FactCheckResult> | null): FactCheckResult {
  const r = raw ?? {};
  return {
    claim: typeof r.claim === 'string' ? r.claim : '',
    overallVerdict: typeof r.overallVerdict === 'string' ? r.overallVerdict : '',
    points: (Array.isArray(r.points) ? r.points : []).map((p) => ({
      statement: p?.statement ?? '',
      verdict: p?.verdict ?? '',
      explanation: p?.explanation ?? '',
      sourceIds: Array.isArray(p?.sourceIds) ? p.sourceIds : [],
    })),
    truthPercentage: 'rationale' in r && typeof r.truthPercentage === 'number' ? r.truthPercentage : NaN,
    rationale: typeof r.rationale === 'string' ? r.rationale : '',
    sources: (Array.isArray(r.sources) ? r.sources : []).filter((s) => s && typeof s.id === 'number' && s.url),
  };
}

async function* readEvents(res: Response): AsyncGenerator<StreamEvent> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = done ? '' : chunks.pop()!;
    for (const chunk of chunks) {
      const data = chunk
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      if (!data || data === '[DONE]') continue;
      try {
        yield JSON.parse(data) as StreamEvent;
      } catch {
      }
    }
    if (done) return;
  }
}

export async function factCheck(
  text: string,
  settings: Settings,
  { maxWords = 0, language = '', signal, onPartial, onStatus }: FactCheckOptions = {},
): Promise<FactCheckResult> {
  if (!settings.apiKey) throw new OpenAIError('No OpenAI API key set. Add one in Settings.');
  const maxSources = settings.maxSources ?? 3;

  const body: Record<string, unknown> = {
    model: settings.model,
    instructions: instructions(settings.webSearch, maxWords, language, maxSources),
    input: text,
    stream: true,
    text: {
      format: { type: 'json_schema', name: 'fact_check', strict: true, schema: SCHEMA },
    },
  };
  if (settings.webSearch) {
    body.tools = [{ type: 'web_search', search_context_size: settings.searchDepth ?? 'low' }];
    body.max_tool_calls = maxSources;
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new OpenAIError('Network error contacting OpenAI. Check your connection.');
  }

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new OpenAIError(data?.error?.message ?? `Request failed with status ${res.status}`);
  }

  let streamed = '';
  let refused = false;
  let final: StreamEvent['response'];
  try {
    for await (const ev of readEvents(res)) {
      switch (ev.type) {
        case 'response.web_search_call.in_progress':
        case 'response.web_search_call.searching':
          onStatus?.('searching');
          break;
        case 'response.output_text.delta':
          if (!streamed) onStatus?.('writing');
          streamed += ev.delta ?? '';
          onPartial?.(fillPartial(parsePartialJson<Partial<FactCheckResult>>(streamed)));
          break;
        case 'response.refusal.delta':
          refused = true;
          break;
        case 'response.completed':
        case 'response.incomplete':
          final = ev.response;
          break;
        case 'response.failed':
          throw new OpenAIError(ev.response?.error?.message ?? 'The request failed.');
        case 'error':
          throw new OpenAIError(ev.message ?? 'The request failed.');
      }
    }
  } catch (e) {
    if (e instanceof OpenAIError || (e as Error).name === 'AbortError') throw e;
    throw new OpenAIError('Connection to OpenAI was interrupted. Please try again.');
  }

  const message = final?.output?.find((o) => o.type === 'message');
  const part = message?.content?.find((c) => c.type === 'output_text');
  const finalText = part?.text ?? streamed;
  if (!finalText) {
    throw new OpenAIError(refused ? 'The model refused to fact-check this text.' : 'Empty response from model.');
  }

  let result: FactCheckResult;
  try {
    result = JSON.parse(finalText);
  } catch {
    const reason = final?.incomplete_details?.reason;
    throw new OpenAIError(
      reason ? `The response was cut off (${reason}). Try a lower word limit.` : 'Could not parse the model response.',
    );
  }

  if (result.sources.length === 0 && part?.annotations?.length) {
    const seen = new Set<string>();
    result.sources = part.annotations
      .filter((a) => a.type === 'url_citation' && a.url && !seen.has(a.url) && seen.add(a.url))
      .map<Source>((a, i) => ({
        id: i + 1,
        title: a.title ?? a.url!,
        publisher: hostname(a.url!),
        url: a.url!,
        summary: '',
      }));
  }

  result.sources = result.sources.slice(0, maxSources);
  result.truthPercentage = Math.max(0, Math.min(100, Math.round(result.truthPercentage)));
  return result;
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
