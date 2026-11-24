import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { factCheck, type FactCheckStatus } from "../lib/openai";
import FactCheckCard from "../components/FactCheckCard";
import type { FactCheckResult } from "../types";

const MAX_CHARS = 8000;
const MAX_WORDS_KEY = "factcheck.maxWords";
const DEFAULT_MAX_WORDS = "100";
const LANGUAGE_KEY = "factcheck.language";
const LANGUAGES = [
  { value: "", label: "Same as text" },
  { value: "English", label: "English" },
  { value: "Spanish", label: "Español" },
  { value: "French", label: "Français" },
  { value: "German", label: "Deutsch" },
  { value: "Portuguese", label: "Português" },
  { value: "Italian", label: "Italiano" },
  { value: "Catalan", label: "Català" },
  { value: "Arabic", label: "العربية" },
];
const MIN_WORDS = 20;
const MAX_WORDS = 2000;

function parseMaxWords(value: string): number {
  const n = parseInt(value, 10);
  if (!value.trim() || Number.isNaN(n) || n <= 0) return 0;
  return Math.min(MAX_WORDS, Math.max(MIN_WORDS, n));
}

export default function CheckPage() {
  const { settings, addHistory } = useStore();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FactCheckResult | null>(null);
  const [status, setStatus] = useState<FactCheckStatus | null>(null);
  const [maxWords, setMaxWords] = useState(
    () => localStorage.getItem(MAX_WORDS_KEY) ?? DEFAULT_MAX_WORDS,
  );
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => localStorage.setItem(MAX_WORDS_KEY, maxWords), [maxWords]);
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem(LANGUAGE_KEY) ?? "";
    return LANGUAGES.some((l) => l.value === saved) ? saved : "";
  });
  useEffect(() => localStorage.setItem(LANGUAGE_KEY, language), [language]);

  const run = async () => {
    const input = text.trim();
    if (!input || loading) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const words = parseMaxWords(maxWords);
    setMaxWords(words ? String(words) : "");
    setLoading(true);
    setError(null);
    setResult(null);
    setStatus(null);
    try {
      const r = await factCheck(input, settings, {
        maxWords: words,
        language,
        signal: ctrl.signal,
        onStatus: (s) => {
          if (abortRef.current === ctrl) setStatus(s);
        },
        onPartial: (partial) => {
          if (abortRef.current === ctrl) setResult(partial);
        },
      });
      if (abortRef.current !== ctrl) return;
      setResult(r);
      addHistory({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        input,
        model: settings.model,
        result: r,
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError" && abortRef.current === ctrl) {
        setResult(null);
        setError((e as Error).message);
      }
    } finally {
      if (abortRef.current === ctrl) {
        setLoading(false);
        setStatus(null);
        abortRef.current = null;
      }
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setStatus(null);
    setResult(null);
  };

  const paste = async () => {
    try {
      setText((await navigator.clipboard.readText()).slice(0, MAX_CHARS));
    } catch {
      setError("Clipboard access was blocked — paste with Ctrl/Cmd+V instead.");
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Fact check a claim</h1>
        <p className="muted">
          Paste a comment, post or article excerpt and the bot will check its
          claims against sources.
        </p>
      </header>

      {!settings.apiKey && (
        <div className="alert alert-warn">
          No OpenAI API key configured.{" "}
          <Link to="/settings">Add one in Settings</Link> to start checking.
        </div>
      )}

      <div className="card input-card">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
          }}
          placeholder="e.g. “Pedro Sánchez paid drug dealers to kill a judge and tried to rig elections.”"
          rows={7}
          disabled={loading}
        />
        <div className="input-actions">
          <div className="input-meta">
            <label
              className="inline-field"
              title="Language the fact check is written in"
            >
              <span>Language</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={loading}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="inline-field"
              title={`Limit the fact-check response length (${MIN_WORDS}–${MAX_WORDS} words). Leave empty for no limit.`}
            >
              <span>Max words</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_WORDS}
                step={10}
                value={maxWords}
                onChange={(e) => setMaxWords(e.target.value)}
                placeholder="No limit"
                disabled={loading}
              />
            </label>
            <span className="muted small">
              {text.length}/{MAX_CHARS} · ⌘/Ctrl+Enter to check
            </span>
          </div>
          <div className="btn-row">
            <button className="btn" onClick={paste} disabled={loading}>
              Paste
            </button>
            <button
              className="btn"
              onClick={() => {
                setText("");
                setResult(null);
                setError(null);
              }}
              disabled={loading || !text}
            >
              Clear
            </button>
            {loading ? (
              <button className="btn btn-danger" onClick={cancel}>
                Cancel
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={run}
                disabled={!text.trim() || !settings.apiKey}
              >
                Fact check
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="card loading">
          <div className="spinner" />
          <span>
            {status === "writing"
              ? "Writing the fact check…"
              : status === "searching"
                ? "Searching the web for sources…"
                : "Checking claims…"}
          </span>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {result && <FactCheckCard result={result} streaming={loading} />}
    </div>
  );
}

