# Review Engine (Phase 3)

The engine that serves review pages. Decisions: D4–D6, D9, D11, D13, D20, D21.

## Layout On Disk

```
.epic-loop/epics/<slug>/reviews/<review-id>/
  page.html            agent-written, English only
  assets/              screenshots and other evidence (or paths elsewhere in the project)
  review.json          id, title, kind, created, schema (derived by check), status
  i18n/<lang>.json     translations of the extracted text segments
  answers.json         written by the engine: control values, savedAt, submittedAt
  problems.jsonl       reports from the "something is wrong" button
```

Reviews are human-facing epic artifacts, so they are not under `.runtime/`.

## App And Routes (D24)

- One app per project with routes:
  - `/` lists the epics;
  - `/<slug>` is the epic home: pending reviews as notifications with a count; Phase 5 grows it into the full overview;
  - `/<slug>/reviews/<id>/` is a review page. The canonical URL ends with `/`, so relative assets in `page.html` resolve inside the review; the address without it redirects (301).
- The manager gives deep links to review routes.

## Server (npm CLI)

- `epic-loop serve`:
  - one server per project, serving every epic's reviews (and later the viewer);
  - `--detach` / `--status` / `--stop`;
  - pidfile and chosen port in `.epic-loop/.runtime/server.json`;
  - a dynamic port by default.
- **API:**
  - static files of a review;
  - `GET`/`PATCH /api/<slug>/reviews/<id>/answers`: the body is `{ controls: { name: value } }`, merged per control so two tabs do not overwrite each other; `answers.json` holds `{ controls, savedAt, submittedAt }`;
  - `POST submit` sets `submittedAt`;
  - `POST problem` appends to `problems.jsonl`.

  All writes are atomic.
- Submit and problem reports are the doorbell events of Phase 4. Phase 3 only writes them to disk.
- Host is `127.0.0.1`; local machine only (D12). The server refuses a foreign `Host` header (DNS rebinding) and cross-origin writes, and caps bodies at 1 MB.
- Pages carry `<meta name="epic-loop-review" content="<slug>/<id>">`; the page runtime builds its API URLs from it.

## Runtime And Components

- **The runtime** (one script and stylesheet served by the engine, injected into every page) owns:
  - answer state, autosave and the save status;
  - the submit bar with progress ("N of M answered");
  - theme (light/dark);
  - language switch (English first, second language from `i18n/`);
  - navigation;
  - the lightbox.
- **Components v1** (custom elements):
  - answer controls: choice (with the recommended option marked), checkbox, comment, select;
  - `shot`: an image that opens in the lightbox with its group. The card's caption and controls move into the popup's side panel, prior-art trick;
  - `iframe` (a URL or inline content);
  - `table`;
  - `diagram` (Mermaid, bundled, no network);
  - `compare`: two or more renders side by side, overlay with opacity, flip one at a time, width presets;
  - `links`;
  - `card`/`section` helpers for the one-decision-per-card pattern.
- **Custom blocks:** page JS may read and write answers only through the runtime API, so the derived schema and autosave still hold.
- **Runtime files** (`packages/cli/src/review/runtime/`, served under `/_runtime/`):
  - `runtime.js` is an ES module, injected as `<script type="module">`;
  - `components.mjs` holds the elements;
  - `answer-store.mjs`, `progress.mjs` and `i18n.mjs` are pure modules, also used by unit tests and the check.
- **Component markup (v1, slice A).** Light-DOM custom elements; every answer control has a `name` and takes its options from child markup, so the check can derive the schema from the HTML alone.
  - `<el-card id="q1" title="…">…</el-card>`: one decision.
  - `<el-section title="…">…</el-section>`: a group.
  - `<el-choice name="…" [label] [recommended="<value>"] [rule="D16"] [optional]><el-option value="…" [note="…"]>Label</el-option>…</el-choice>`: radio options; the value is the option value.
  - `<el-check name="…" [optional]>Label</el-check>`: a confirmation; its value is `true` or `false`, and it counts as answered only when checked.
  - `<el-select name="…" [label] [placeholder] [optional]><el-option value="…">…</el-option></el-select>`.
  - `<el-comment name="…" [label] [placeholder] [rows] [optional]></el-comment>`: free text.
  - `<el-links><a href="…">…</a></el-links>` and `<el-table><table>…</table></el-table>`.
  - Controls are required unless marked `optional`. Progress counts required controls.
  - Without JS the elements still render as readable blocks, and options show as a list.
- **`window.epicLoop`:**
  - `get(name)`, `set(name, value)`, `onChange((name, value, { local }) => …)`;
  - `registerControl(name, { optional, kind })` for custom blocks;
  - `review` (`slug`, `id`, `apiBase`, `pageBase`).
- **Saving.** Changes are debounced (400 ms) into one `PATCH` of only the changed controls. A failed save retries with backoff (1 s → 30 s) and warns before unload. When the tab becomes visible again, answers are re-fetched, unless a local edit is pending.

## Translations (contract shared by the runtime and the check)

- **Segments.** A segment is a visible text node, or the value of a `title`, `placeholder`, `aria-label`, `note` or `alt` attribute. Its key is the English text normalized by `normalizeSegment` in `i18n.mjs`: runs of whitespace collapse to one space, and the ends are trimmed. Segments without a letter (numbers, punctuation) are not translated.
- **Never translated:** text inside `script`, `style`, `textarea`, `code`, `pre` and `[data-i18n-skip]`, and the runtime's own UI.
- **Source file.** `i18n/source.json` (written by the check) lists the segments.
- **Translation file.** `i18n/<lang>.json` is `{ "lang": "<code>", "segments": { "<normalized English>": "<translation>" } }`.
- **Available languages.** They come from `review.json` (`"languages": ["ru"]`); with none listed, the switch is hidden.
- **Switching.** The runtime replaces each segment that has a translation and keeps the original's surrounding whitespace. Switching back to English restores the original text and attributes exactly. The choice is remembered per review.
- **"Something is wrong with this page"** (D21): injected by the server outside the page's DOM tree, with no dependency on page code. It works when the page is broken.

## Check (static, D21)

`epic-loop review check <review>`:
- control names unique and non-empty;
- every referenced local file exists;
- no network script sources, no forms posting elsewhere;
- writes the derived answer schema into `review.json`;
- extracts text segments into `i18n/source.json`;
- reports missing or stale translations for the chosen second language.

## Subagents (D4)

- **Page builder** (same model as the main session).
  - Input: a review request from the manager: what to ask, why, the evidence, the proportionality level (D6).
  - Output: `page.html` passing the check, plus a gate summary (id, URL, two lines).
- **Translator** (cheap model).
  - Input: `i18n/source.json` and the target language.
  - Output: `i18n/<lang>.json`.
- Both are instructed from a skill reference (component catalog plus content rules). The main thread receives only the result.
- Content rules carried over from prior art:
  - one decision per card;
  - the consequence of each answer;
  - evidence on the card;
  - a recommendation that names the rule it follows;
  - ask only what can be answered from the screen;
  - a choice with no visible or cost difference is not asked.
