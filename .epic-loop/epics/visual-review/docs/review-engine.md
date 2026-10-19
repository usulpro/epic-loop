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
- **Visual elements (v1, slice B).** None of them is an answer control.
  - `<el-shot caption="…" [group="g1"] [width]><img src="assets/x.png" alt="…" /></el-shot>`, or `<el-shot src="…" alt="…">` (that form shows nothing without JS).
    - A click, Enter or Space opens the lightbox.
    - The counter and ←/→ page through shots of the same `group`, or through all ungrouped shots. Esc closes it and focus returns to the shot.
    - The side panel shows the caption and the shot's card. While the panel is open, the card's answer controls are moved into it (not cloned), and digits pick an option there.
    - The injected problem control is hidden while the lightbox is open.
  - `<el-iframe src="https://…|assets/page.html" [title] [height]>` shows a live page; inline HTML goes in `<el-iframe title="…"><template>…</template></el-iframe>` (or a `srcdoc` attribute).
    - A `<template>` keeps the inline markup inert in the page; inline scripts must not run in the review page itself.
    - Inline pages and same-origin assets get `sandbox="allow-scripts"`, an opaque origin with no access to `window.epicLoop` or the API. Only a cross-origin URL also gets `allow-same-origin allow-forms allow-popups`.
    - Put a fallback `<a>` inside for readers without JS.
  - `<el-diagram [caption]>` holds the Mermaid source as text content (escape `<`).
    - It is rendered by bundled Mermaid, with `securityLevel: "strict"` and no network.
    - Mermaid loads only when the page has a diagram, and the diagram re-renders when the theme changes.
    - If rendering fails, the source is shown with an error note.
  - `<el-compare [mode="side|overlay|flip"] [widths="375,1280"] [caption]>` takes two or more `el-shot` or `img` children, each with a `label`.
    - Modes: side by side, overlay with an opacity slider, or flip (button or Space).
    - The width presets constrain the panes.
- **Mermaid.** `mermaid` is an exact-pinned devDependency of `packages/cli`, and its single-file build is served from `/_runtime/vendor/mermaid.min.js`.
  - The build copies it into `dist/review/runtime/vendor/`; from source it is read from `node_modules`.
  - Only allow-listed vendor names are served (`REVIEW_VENDOR_FILES` in `paths.mjs`).
- **Local files the check must verify:**
  - `el-shot` `src` and its `img` `src`;
  - `img` `src` inside `el-compare`;
  - `el-iframe` `src` when relative;
  - plain `img`, `a` and `link` targets.

  `el-iframe` `src` may be an external `https:` URL; any other network reference in a page (scripts, styles) is refused.
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

`epic-loop review check <slug>/<id> | <review folder> [--root <dir>] [--lang <code>] [--json]`

- **Exit codes.** 0 when the page passes (warnings allowed); 1 on any error.
- **`--json` output.** `{ ok, errors: [{ code, message, line? }], warnings, schema, segments: <count>, translations: { <lang>: { missing, stale } } }`.
- **Parser.** A small built-in parser (`packages/cli/src/review/html.mjs`). Input it cannot parse reliably (an unterminated tag, comment or raw-text element) fails with `E_PARSE` and a line number.
- **Writes only on a clean page.** It writes `review.json` and `i18n/source.json` atomically, and only when there are no errors; a failing page keeps its previous files.
  - `review.json` keeps its existing fields (`id`, `title`, `kind`, `created`, `languages`, `status`) and gains `schema` and `checkedAt`.
  - `schema` is `{ controls: [{ name, kind: choice|check|select|comment, optional, label?, options?: [{ value, label }], recommended?, rule?, card? }] }`, in document order. `card` is the enclosing card's `id` (or title).
  - `i18n/source.json` is `{ segments: [...] }`: unique, in document order, stable across reruns.
- **Segments** follow the Translations contract below and use the runtime's own functions:
  - text nodes, plus the attributes `title`, `placeholder`, `aria-label`, `note`, `alt`, `label` and `caption`;
  - nothing from the head, `script`, `style`, `textarea`, `code`, `pre`, `<template>` contents, `el-diagram` source, or `[data-i18n-skip]`;
  - an `el-diagram` caption is a segment.

### Errors

- **Controls and options:**
  - `E_NAME_MISSING`, `E_NAME_DUPLICATE`: an answer control without a name, or a name used twice.
  - `E_OPTIONS_TOO_FEW`, `E_OPTION_DUPLICATE`, `E_RECOMMENDED_UNKNOWN`: a choice or select with fewer than two options, a repeated option value, or a `recommended` value that is not an option.
- **Images:**
  - `E_SHOT_NO_IMAGE`: an `el-shot` without an `img` or `src`.
  - `E_COMPARE_TOO_FEW`, `E_COMPARE_LABEL`: an `el-compare` with fewer than two images, or an image without a `label`.
- **Local files:** `E_FILE_MISSING`, `E_FILE_OUTSIDE`. A local reference must exist inside the review folder. `/_runtime/…` paths are checked against the runtime.
  - The checked references are `img`, `source`, `audio`, `track`, `el-shot`, `el-iframe` and `script` `src`; `video` `src` and `poster`; and `a` and `link` `href`.
  - Fragment links, `mailto:` and `data:` are fine.
- **Network:**
  - `E_NETWORK_SCRIPT`: a script from the network, including inside a `<template>`.
  - `E_NETWORK_STYLESHEET`, `E_NETWORK_LINK`: a stylesheet or a resource-loading `link` from the network.
  - `E_NETWORK_MEDIA`: images, video or audio from the network; save evidence next to the page.
  - `E_NETWORK_FRAME`: an `el-iframe` with a URL that is not `https:`.
  - `E_CSS_IMPORT`, `E_NETWORK_CSS`: `@import`, or a network `url()`, in a `style` element or a `style` attribute.
  - Links (`a href`) to the network are allowed.
- **Unsafe markup:**
  - `E_IFRAME`: a plain `iframe`, `frame`, `object` or `embed`; use `el-iframe`.
  - `E_FORM_ACTION`: a `form` with an `action`.
  - `E_BASE`: a `<base>` element.
  - `E_META_REFRESH`: `<meta http-equiv="refresh">`.
- **Other:**
  - `E_TRANSLATION_MISSING`: only with `--lang <code>`.
  - `E_PARSE`, `E_NO_PAGE`: the page cannot be parsed reliably, or there is no `page.html`.

### Warnings

- `W_EVENT_HANDLER`: an inline `on…` attribute.
- `W_IMG_ALT`: an image without `alt`.
- `W_CARD_CHOICES`: more than one choice in a card.
- `W_NO_CONTROLS`: no answer controls and no `registerControl` call; the page can only be acknowledged.
- `W_TRANSLATION_MISSING`, `W_TRANSLATION_STALE`: for each language in `review.json` `languages`.

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
