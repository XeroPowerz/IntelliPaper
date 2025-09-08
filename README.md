# Simple Docs — Google Docs-style Editor with Inline AI

A minimal, local HTML editor that feels like Google Docs: a centered white page, light toolbar, and a floating selection menu that can ask AI to rewrite text inline. No build step is required for the editor. A tiny Node server powers the AI calls so API keys never touch the browser.

## Editor Quickstart

- Open `simple-docs/index.html` in your browser.
- Type on the white page. Use the top toolbar for Undo/Redo and Export (HTML/Markdown).
- Select some text to reveal the floating menu.
  - Ask AI: opens an inline prompt to describe an edit (e.g., “make this more formal”).
  - B / I: quick bold/italic.
  - Aa: cycles case (UPPER ? lower ? Title).

## AI Setup (Secure, Server-side Keys)

Keys are read on the server only. The client never sees them.

1) Prepare the server
- `cd server`
- Copy `.env.example` to `.env`
- Set environment variables:
  - `MODEL_PROVIDER=openai`
  - `MODEL_NAME=gpt-4o-mini`
  - `OPENAI_API_KEY=sk-...` (your key)
- Start the server (Node 18+):
  - `node index.js`
- Optional: check health at `GET http://localhost:3000/api/ai/health` (returns `{ ok, provider, model, hasKey }`).

2) Point the editor at the server
- In the editor, select text ? click “Ask AI”.
- When prompted the first time, enter: `http://localhost:3000/api/ai/transform`.
- The endpoint is saved in `localStorage` (`aiEndpoint`).

3) Use it
- Ask AI (freeform) streams a live preview. Click “Accept” to replace the selection inline or “Keep original” to discard.
- One-click actions (Rewrite, Summarize, Expand, Outline) call the same endpoint with preset prompts.

## API (Server)

POST `/api/ai/transform`
- Request (JSON):
  ```json
  {
    "action": "rewrite" | "summarize" | "expand" | "outline" | "freeform",
    "text": "…",              // selected text
    "instruction": "…",       // for freeform (optional)
    "docContext": "…",        // surrounding text (optional)
    "systemHint": "…"         // short system prompt (optional)
  }
  ```
- Streaming (recommended): set header `Accept: text/event-stream`. The server emits `data: "token"` lines ending with `data: [DONE]`.
- Fallback: if not streaming, returns `{ "result": "…" }`.
- Mock mode: if `OPENAI_API_KEY` is not set, returns deterministic mock output for development.

## Provider Abstraction

- Current provider: OpenAI via `OPENAI_API_KEY` and `MODEL_NAME`.
- Pluggable design (`server/llm.js`) allows additional providers without client changes.

## Security & Repo Hygiene

- Do not commit secrets. Use `.env` files only under `server/`.
- `.gitignore` excludes `node_modules/`, `.next/`, and env files.
- The browser never receives your API key.

## Troubleshooting

- “Ask AI” prompts every time for an endpoint: open DevTools ? Application ? Local Storage ? remove `aiEndpoint`; then re-enter the correct URL.
- Streaming doesn’t update the preview: ensure the server is running on `http://localhost:3000` and that the request sets `Accept: text/event-stream`. The client falls back to non-stream JSON automatically.
- CORS: server allows `*`. If you change ports or deploy, adjust as needed.

## Project Layout

- `simple-docs/` — static editor (open `index.html` directly)
- `server/` — minimal AI backend (env-driven, no keys in client)
