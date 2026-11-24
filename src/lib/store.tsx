import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { HistoryEntry, Settings } from '../types';

const SETTINGS_KEY = 'factcheck.settings';
const HISTORY_KEY = 'factcheck.history';

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'gpt-4.1-mini',
  webSearch: true,
  searchDepth: 'low',
  maxSources: 3,
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface StoreValue {
  settings: Settings;
  saveSettings: (s: Settings) => void;
  history: HistoryEntry[];
  addHistory: (e: HistoryEntry) => void;
  removeHistory: (id: string) => void;
  clearHistory: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => load(SETTINGS_KEY, DEFAULT_SETTINGS));
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const addHistory = useCallback((e: HistoryEntry) => setHistory((h) => [e, ...h]), []);
  const removeHistory = useCallback((id: string) => setHistory((h) => h.filter((e) => e.id !== id)), []);
  const clearHistory = useCallback(() => setHistory([]), []);

  return (
    <StoreContext.Provider
      value={{ settings, saveSettings: setSettings, history, addHistory, removeHistory, clearHistory }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
