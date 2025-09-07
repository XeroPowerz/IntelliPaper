# Intelligence Paper MVP

An AI-native word processor focused on understanding, reasoning, and feedback. It helps writers produce clear, structured, and polished text while preserving their unique voice. AI is the foundation: transforms run through a local OpenAI proxy.

## One-Page Spec

- **Product Goal:** AI-native word processor that clarifies, structures, and polishes without changing the writer’s voice or adding facts.
- **Core Commands:**
- **`/plan`:** Convert rough notes into a simple outline. Model-guided; preserves order and phrasing.
- **`/write`:** Expand an outline into a readable draft. Converts bullets to sentences/paragraphs with capitalization and punctuation only; no new facts.
  - **`/refine`:** Improve clarity, structure, and flow. Cleans spacing, punctuation, repeated words, and paragraphing; preserves tone.
- **Editing Principles:**
  - **Voice Preservation:** Keep original wording and tone; avoid stylistic overreach.
  - **No New Facts:** Transform only what’s present; never insert external information.
  - **Transparent Changes:** Every AI change shows a before/after diff; user must Apply to commit.
- **Interface:**
  - Single writing pane (textarea) and a right sidebar.
  - Sidebar hosts Commands, Diff (Before/After with highlights), and Export.
  - Actions: Apply, Discard, Undo/Redo.
- **User Flow:**
  - Type/paste notes → run `/plan` → review diff → Apply.
  - Iterate with `/write` and `/refine` as needed.
  - Export to `.md` or `.docx`.
- **System Architecture (Prototype):**
  - Client SPA + local proxy: static `index.html`, `styles.css`, `app.js` + `server/index.js` (Node, no deps).
  - Modules: UI (editor/sidebar), Diff (word-level LCS), Export (Markdown + minimal DOCX), OpenAI proxy.
  - Data model: `documentText`, `pendingChange`, `history` (undo/redo).
  - Constraints: Strict prompts; no new facts; JSON-only responses from the model.
- **Acceptance Criteria:**
  - Working editor + sidebar; commands produce proposed text; diff highlights insertions/deletions; apply/undo works; exports `.md` and `.docx`.

## Quickstart (Next.js app)

- Go to `ai-writer/`
  - Set env: `OPENAI_API_KEY` (required), `OPENAI_MODEL` optional (`gpt-4o-mini` default)
  - Install deps: `npm install`
  - Dev: `npm run dev` (starts on `http://localhost:3001`)
- Open `http://localhost:3001` in your browser.
- On first launch, you’ll see “What do you want to write?” — submit to draft instantly. No blank pages.

## Onboarding Flow

- On first launch (or when no document exists), the app asks: “What are you trying to say?”
- Enter your intent in plain language and click “Create Draft”. A draft is generated instantly via the built-in AI API.
- Your document is saved locally (browser storage), so you never land on an empty page again.
- After the draft is created, the intent box disappears. Bring it back anytime with `Ctrl+I`.

## Fluid Canvas, Adaptive Structure

- No pages, margins, headers, or footers — just a continuous writing canvas.
- The AI analyzes the draft’s purpose and detects structure automatically (blog post, script, memo, email, essay, report).
- The sidebar shows a live Structure preview and a “Reshape” button to propose a structured rewrite. All changes still flow through the diff for transparency.

## Magic Editing

- Highlight any passage → press `Ctrl+J` → type an instruction (e.g., “make this more inspiring”) → Enter. The selection updates immediately; the diff shows exactly what changed.

## Personal Memory

- A lightweight, persistent memory learns your style (vocabulary + sentence length) locally and informs every AI call. No switches, no modes.

## Export

- Export to `.md`. Use browser print for `.pdf`. “Formats” (Speech/Blog/Slides/Video) propose structure-aware rewrites that you can apply via diff.

## Usage

- **Write:** Type or paste your notes into the main editor.
- **Plan (`/plan`):** Turns rough notes into a flat outline (bullets). Review the diff in the sidebar and click Apply to accept.
- **Write (`/write`):** Converts bullets to sentences and groups them into short paragraphs without adding content.
- **Refine (`/refine`):** Cleans spacing, punctuation, repeated words; improves paragraph breaks; preserves voice.
- **Diff:** Side-by-side Before/After; green = insertions, red strike-through = deletions.
- **Undo/Redo:** Toolbar buttons or `Ctrl+Z` / `Ctrl+Y`.
- **Export:** Use Export `.md` or `.docx` in the sidebar.

## OpenAI Setup

This project includes a tiny, dependency-free Node proxy. Your API key never lives in the browser; the client talks only to your local server.

- Prereqs: Node 18+ (for built-in `fetch`).
- Env vars:
  - `OPENAI_API_KEY` (required)
  - `OPENAI_MODEL` (optional, default: `gpt-4o-mini`)
- Run the server:
  - `node server/index.js`
- In the app sidebar, set the endpoint (default `http://localhost:3000`) and click Test.
- Endpoints:
  - `POST /api/transform` with JSON `{ mode: "intent"|"plan"|"write"|"refine", text: string }` → `{ text: string }`
  - `GET /api/health` → `{ ok, model, hasKey }`

Guardrails in prompts ensure: no new facts, voice preserved, JSON-only responses.

## Notes & Guardrails

- All transformations go through the OpenAI proxy with strict prompts: no new facts, preserve voice, JSON-only output.
- The DOCX export builds a minimal OOXML package and zips it in-browser using a tiny ZIP writer (no compression). It’s basic but opens in Word/Pages/Google Docs.
- Diff uses word-level LCS; very large documents may render diffs more slowly.

## Roadmap (Post-MVP ideas)

- Style learning from examples; per-document tone settings.
- Section-aware structuring; headings and nested outlines.
- Inline accept/reject per change; change history timeline.
- Better .docx styling and metadata; .pdf export.
