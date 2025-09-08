# AI Integration — Intelligent Paper

**Goal:** Wire real AI into the floating menu so the document becomes "alive"—while keeping keys secure and the UI inline-only.

---

We now have a floating menu (Ask AI, B, I, Aa). Integrate an AI backend so “Ask AI” and (later) Summarize/Expand/Outline work inline. Do this in a clean, provider‑agnostic way.

**Requirements:**

1. **Security / config**

- Never expose API keys to the client. Keys must be read server‑side from environment variables.
- Add `.env.example` with:
  - `MODEL_PROVIDER=openai` (support “openai”, “anthropic” later)
  - `MODEL_NAME=gpt-4o-mini` (default)
  - `OPENAI_API_KEY=`
- Add README section **AI Setup** with steps to create `.env.local` and restart dev server.

2. **API shape**

- Create a server endpoint `POST /api/ai/transform`.
- **Request body:**

```
{
  action: "rewrite" | "summarize" | "expand" | "outline" | "freeform",
  text: string,            // selected text
  instruction?: string,    // for freeform prompts (from “Ask AI”)
  docContext?: string,     // optional surrounding text
  systemHint?: string      // optional: “You are the Intelligent Paper engine…”
}
```

- **Response:** stream tokens (text/event-stream) and also support a non‑stream JSON fallback:

```
{ result: string }
```

3. **Provider abstraction**

- Create `src/intelligence/providers/index.ts` with:

```
export interface LLM {
  stream(opts: { system?: string; prompt: string; model?: string }): AsyncIterable<string>;
  complete(opts: { system?: string; prompt: string; model?: string }): Promise<string>;
}
```

- Implement `src/intelligence/providers/openai.ts` using env `OPENAI_API_KEY` and `MODEL_NAME`.
- In `src/intelligence/llm.ts`, choose provider by `MODEL_PROVIDER` and export a singleton `llm`.

4. **Prompting logic (server)**

- Map actions → prompts:
  - **rewrite:** “Rewrite the following text to improve clarity and flow. Keep meaning.”
  - **summarize:** “Summarize the following text concisely.”
  - **expand:** “Expand the following text with 2–3 useful details.”
  - **outline:** “Produce a hierarchical outline of the following text.”
  - **freeform:** use `instruction` directly.
- Build final prompt using `text` + optional `docContext` (limit length).
- Include a short `systemHint`: “You are Intelligent Paper. Be concise. Return only the transformed text, no preamble.”

5. **Client integration**

- In the floating menu:
  - **Ask AI:** open a small inline input; on submit, call `/api/ai/transform` with `action:"freeform"`, `text:selectedText`, `instruction:userInput`.
  - **Rewrite/Summarize/Expand/Outline:** call the same endpoint with the corresponding `action`.
  - **Streaming:** render partial output below the selection with a subtle “Streaming…” state; when complete, replace or insert per user choice (Accept / Keep original).
  - Show graceful errors inline (toast + keep original text).
  - Disable menu while request in flight; show a small spinner on the active control.

6. **UX rules**

- Everything stays **inline**. No sidebars/modals.
- Selection → menu → result appears in the doc.
- Provide an **Undo** immediately after apply (hook into editor undo stack).
- Keep latency low: debounce context gathering; cap tokens.

7. **Dev ergonomics**

- **Mock mode:** if no API key is set, the endpoint returns deterministic fake outputs (e.g., wrap with `[REWRITE]…[/REWRITE]`) so the UI can be tested without a key.
- Add simple tests for: request building, provider selection, error paths.

8. **Acceptance criteria**

- With a valid key, **Ask AI** replaces/inserts text inline and supports streaming.
- **Rewrite/Summarize/Expand/Outline** work from the same menu and endpoint.
- Keys never appear in client bundles.
- Mock mode works with no key.
- README explains setup in ≤10 steps.

**After implementation:**

- Print the list of files changed and a 5‑bullet summary of architectural decisions.
- Confirm that floating‑menu actions are backed by the API and demonstrate one end‑to‑end example.

