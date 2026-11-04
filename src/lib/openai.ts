import type { FactCheckResult, Settings, Source } from '../types';

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

function instructions(webSearch: boolean, maxWords: number, language: string): string {
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

interface ResponsesOutputItem {
  type: string;
  content?: { type: string; text?: string; annotations?: { type: string; url?: string; title?: string }[] }[];
}

export class OpenAIError extends Error {}

export interface FactCheckOptions {
  /** Target max words for the visible fact-check text. 0 = no limit. */
  maxWords?: number;
  /** Language name to respond in, e.g. "Spanish". Empty = match the input text. */
  language?: string;
  signal?: AbortSignal;
}

export async function factCheck(
  text: string,
  settings: Settings,
  { maxWords = 0, language = '', signal }: FactCheckOptions = {},
): Promise<FactCheckResult> {
  if (!settings.apiKey) throw new OpenAIError('No OpenAI API key set. Add one in Settings.');

  const body: Record<string, unknown> = {
    model: settings.model,
    instructions: instructions(settings.webSearch, maxWords, language),
    input: text,
    text: {
      format: { type: 'json_schema', name: 'fact_check', strict: true, schema: SCHEMA },
    },
  };
  // search_context_size controls how much page content each search adds to the prompt ("low" = fewest tokens).
  if (settings.webSearch) {
    body.tools = [{ type: 'web_search', search_context_size: settings.searchDepth ?? 'low' }];
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

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error?.message ?? `Request failed with status ${res.status}`;
    throw new OpenAIError(msg);
  }

  const output: ResponsesOutputItem[] = data?.output ?? [];
  const message = output.find((o) => o.type === 'message');
  const part = message?.content?.find((c) => c.type === 'output_text');
  if (!part?.text) {
    const refusal = message?.content?.find((c) => c.type === 'refusal');
    throw new OpenAIError(refusal ? 'The model refused to fact-check this text.' : 'Empty response from model.');
  }

  let result: FactCheckResult;
  try {
    result = JSON.parse(part.text);
  } catch {
    throw new OpenAIError('Could not parse the model response.');
  }

  // Fall back to web-search citations if the model returned no sources itself.
  if (result.sources.length === 0 && part.annotations?.length) {
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
