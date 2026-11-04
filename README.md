# FactCheck Bot

A React web app that uses OpenAI to fact-check pasted text such as comments, posts or article excerpts.

Each result shows the claim, a verdict for each sub-claim, a truth percentage, and numbered sources. Click a source to see its summary and link.

## Features

- **Fact checks with sources.** Uses the OpenAI Responses API with web search, so citations point to real, current pages.
- **Per-check options.** Choose the response language and a maximum word count.
- **Copy for Reddit.** Copies the result as formatted text. It pastes cleanly into Reddit's rich-text editor and in Markdown mode.
- **History.** Past checks are saved in the browser and can be searched and deleted.
- **Settings.** Set your OpenAI API key, the model, web search on/off, and search depth (low/medium/high, which trades detail for token cost).
- Works on mobile with a burger menu.

## Getting started

Requires Node 20+.

```bash
npm install
npm run dev
```

Open the app, go to **Settings**, and add your OpenAI API key.

## Notes

- Your API key is stored in the browser's `localStorage`, and requests go straight from the browser to `api.openai.com`. That's fine for personal use. For a public deployment, route requests through a backend so the key isn't exposed.
- AI fact checks can be wrong. Always review the sources.

## Scripts

| Command           | Description                     |
| ----------------- | ------------------------------- |
| `npm run dev`     | Start the dev server            |
| `npm run build`   | Type-check and production build |
| `npm run lint`    | Lint with oxlint                |
| `npm run preview` | Preview the production build    |
