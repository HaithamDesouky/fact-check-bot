export interface Source {
  id: number;
  title: string;
  publisher: string;
  url: string;
  summary: string;
}

export interface ClaimPoint {
  statement: string;
  verdict: string;
  explanation: string;
  sourceIds: number[];
}

export interface FactCheckResult {
  claim: string;
  overallVerdict: string;
  points: ClaimPoint[];
  truthPercentage: number;
  rationale: string;
  sources: Source[];
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  input: string;
  model: string;
  result: FactCheckResult;
}

export interface Settings {
  apiKey: string;
  model: string;
  webSearch: boolean;
  searchDepth: SearchDepth;
  maxSources: number;
}

export type SearchDepth = 'low' | 'medium' | 'high';
