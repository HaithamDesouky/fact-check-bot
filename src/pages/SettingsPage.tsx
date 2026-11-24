import { useState, type FormEvent } from 'react';
import { DEFAULT_SETTINGS, useStore } from '../lib/store';
import type { SearchDepth } from '../types';
import TwoFactorSettings from '../components/TwoFactorSettings';

const MODEL_SUGGESTIONS = ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o', 'gpt-5-mini', 'gpt-5'];
const SOURCE_LIMITS = [1, 2, 3, 5, 8];
const CUSTOM = '__custom__';

const SEARCH_DEPTHS: { value: SearchDepth; label: string; hint: string }[] = [
  { value: 'low', label: 'Low', hint: 'Fewest tokens and fastest. Good for most claims.' },
  { value: 'medium', label: 'Medium', hint: 'More page detail per search. Moderate token use.' },
  { value: 'high', label: 'High', hint: 'Most detail, best for niche or very recent claims. Highest token use and slowest.' },
];

export default function SettingsPage() {
  const { settings, saveSettings } = useStore();
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  const [customModel, setCustomModel] = useState(!MODEL_SUGGESTIONS.includes(settings.model));
  const [webSearch, setWebSearch] = useState(settings.webSearch);
  const [searchDepth, setSearchDepth] = useState<SearchDepth>(settings.searchDepth);
  const [maxSources, setMaxSources] = useState(settings.maxSources);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const finalModel = model.trim() || DEFAULT_SETTINGS.model;
    setModel(finalModel);
    setCustomModel(!MODEL_SUGGESTIONS.includes(finalModel));
    saveSettings({ apiKey: apiKey.trim(), model: finalModel, webSearch, searchDepth, maxSources });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Settings</h1>
        <p className="muted">Configure how the bot talks to OpenAI.</p>
      </header>

      <form className="card form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">OpenAI API key</span>
          <div className="input-group">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="btn" onClick={() => setShowKey((s) => !s)}>
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <span className="muted small">
            Stored only in this browser's localStorage and sent directly to api.openai.com. Get a key at{' '}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
              platform.openai.com/api-keys
            </a>
            .
          </span>
        </label>

        <label className="field">
          <span className="field-label">Model</span>
          <select
            value={customModel ? CUSTOM : model}
            onChange={(e) => {
              if (e.target.value === CUSTOM) {
                setCustomModel(true);
              } else {
                setCustomModel(false);
                setModel(e.target.value);
              }
            }}
          >
            {MODEL_SUGGESTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value={CUSTOM}>Custom…</option>
          </select>
          {customModel && (
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Enter any OpenAI model name, e.g. gpt-5.1"
              spellCheck={false}
              autoFocus
            />
          )}
          <span className="muted small">Must support the Responses API and structured outputs.</span>
        </label>

        <label className="field checkbox">
          <input type="checkbox" checked={webSearch} onChange={(e) => setWebSearch(e.target.checked)} />
          <span>
            <span className="field-label">Use web search</span>
            <span className="muted small block">
              Lets the model search the web for current, real sources (recommended). Adds cost and latency.
            </span>
          </span>
        </label>

        <fieldset className="field" disabled={!webSearch}>
          <legend className="field-label">Search depth</legend>
          <div className="segmented" role="radiogroup">
            {SEARCH_DEPTHS.map((d) => (
              <label key={d.value} className={searchDepth === d.value ? 'active' : ''}>
                <input
                  type="radio"
                  name="searchDepth"
                  value={d.value}
                  checked={searchDepth === d.value}
                  onChange={() => setSearchDepth(d.value)}
                />
                {d.label}
              </label>
            ))}
          </div>
          <span className="muted small">
            {webSearch
              ? SEARCH_DEPTHS.find((d) => d.value === searchDepth)?.hint
              : 'Only applies when web search is on.'}
          </span>
        </fieldset>

        <fieldset className="field">
          <legend className="field-label">Max sources</legend>
          <div className="segmented" role="radiogroup">
            {SOURCE_LIMITS.map((n) => (
              <label key={n} className={maxSources === n ? 'active' : ''}>
                <input
                  type="radio"
                  name="maxSources"
                  value={n}
                  checked={maxSources === n}
                  onChange={() => setMaxSources(n)}
                />
                {n}
              </label>
            ))}
          </div>
          <span className="muted small">
            Caps how many web searches the model runs and how many sources it cites. Fewer = faster and cheaper.
          </span>
        </fieldset>

        <div className="btn-row">
          <button type="submit" className="btn btn-primary">
            Save settings
          </button>
          {settings.apiKey && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setApiKey('');
                saveSettings({ ...settings, apiKey: '' });
              }}
            >
              Remove key
            </button>
          )}
          {saved && <span className="saved">✓ Saved</span>}
        </div>
      </form>

      <TwoFactorSettings />
    </div>
  );
}
