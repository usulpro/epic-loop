# Review Pages

How a page builder turns a review request into a checked review page. The manager never builds pages itself: it fills [../assets/templates/review-page-builder-brief.md](../assets/templates/review-page-builder-brief.md) and delegates (see "Review Pages" in [implementation-manager-role.md](implementation-manager-role.md)). Visual design and markup examples: [review-design.md](review-design.md).

## Contents

- [When To Build A Page](#when-to-build-a-page)
- [Layout On Disk](#layout-on-disk)
- [Components](#components)
- [Content Rules](#content-rules)
- [Evidence And Assets](#evidence-and-assets)
- [The Check Loop](#the-check-loop)
- [Custom Blocks](#custom-blocks)
- [Gate Summary](#gate-summary)

## When To Build A Page

Match the request to the proportionality ladder:

1. **Plain text** for a trivial yes or no: no page; the manager writes it in the chat or the stop report.
2. **A page with cards and evidence**: the default for decisions, confirmations and reviews of results.
3. **Interactive comparison and choice**: compare frames, galleries, several renders side by side.

- Product and design decisions are never asked as plain text.
- A choice with no visible difference and no cost difference is not asked at all: take the default and say so in the summary.

## Layout On Disk

```
.epic-loop/epics/<slug>/reviews/<review-id>/
  page.html          English only, written by you
  assets/            screenshots and files the page shows
  review.json        { id, title, kind, created, languages }; the check adds schema and checkedAt
  i18n/              source.json (from the check); <lang>.json (from the translator)
```

- Review id: `<YYYY-MM-DD>-<short-topic>`, lowercase letters, digits and hyphens (for example `2026-10-20-doorbell-choice`).
- Write `review.json` before the first check: `id`, `title`, `kind` (`decision`, `confirmation`, `result`, `stop-report`), `created` (the current time, ISO), and `languages` from the brief.
- Do not create `answers.json` or `problems.jsonl`; the server writes them.

## Components

Answer controls (each needs a unique `name`; add `optional` for non-essential ones):

- `<el-choice name label? recommended rule><el-option value note>Label</el-option>…</el-choice>`: one of several options; at least two.
- `<el-check name>Label</el-check>`: a confirmation; counts as answered only when checked.
- `<el-select name label?><el-option value>Label</el-option>…</el-select>`: one of many (long lists).
- `<el-comment name label? placeholder optional></el-comment>`: free text.

Layout and evidence:

- `<el-card id title>`: one decision. `<el-section title>`: a group of cards or evidence.
- `<el-shot caption group?><img src="assets/x.png" alt="…"></el-shot>`: a screenshot that opens in the lightbox; put it inside the card it supports.
- `<el-compare caption widths?>` with two or more `<el-shot label>` children: before and after, or variants.
- `<el-iframe src title height>`: a live page (an `https:` URL or a file in `assets/`); inline HTML goes in a `<template>`.
- `<el-diagram caption>` with Mermaid source: flows and structure.
- `<el-table><table>…</table></el-table>`, `<el-links><a href>…</a></el-links>`, plain `<p>`, `<h1>`, `<ul>`, `<code>`.

Use this skeleton; the runtime adds the submit bar, autosave, theme and language switch, so do not build them:

```html
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Short title</title></head>
  <body>
    <main class="el-main">
      <div class="el-page-head"><div class="el-label">decision</div><h1>Short title</h1><p>What is asked and why, in one paragraph.</p></div>
      <el-card id="q1" title="…">…</el-card>
    </main>
  </body>
</html>
```

## Content Rules

- **One decision per card.** Several questions mean several cards.
- **Each option states its consequence** in its `note`: what happens if the human picks it.
- **Evidence is on the card**: the screenshot, numbers or diff the decision rests on, not a link to elsewhere.
- **A recommendation names its rule**: `recommended="…" rule="D16"`. Keep `rule` short (a decision id or a few words): it is shown next to the tag.
- **Ask only what can be answered from the screen.** If the answer needs a file the human cannot see, show it.
- **No question without a visible or cost difference.**
- **English only.** The translator adds the second language; never write a translation into the page.
- Plain, short sentences. No marketing tone, no emoji.

## Evidence And Assets

- Copy every screenshot and file the page shows into `assets/` and reference it relatively (`assets/home.png`).
- Nothing from the network: no external images, scripts, stylesheets or fonts. Links (`<a href="https://…">`) to external docs are fine; an `el-iframe` may show an `https:` page.
- Prefer PNG or SVG screenshots; keep them under a few MB each.
- Give every image an `alt`.

## The Check Loop

```bash
node <skill-dir>/scripts/epic-loop.mjs review check <slug>/<review-id> --json
```

- Read every `errors[].code` and fix the page, then run the check again. The page is done only when `ok` is `true`.
- Each error's message says what to fix. Common codes: `E_NAME_DUPLICATE`, `E_OPTIONS_TOO_FEW`, `E_RECOMMENDED_UNKNOWN`, `E_FILE_MISSING` (copy the file into `assets/`), `E_NETWORK_*` (save it locally), `E_IFRAME` (use `el-iframe`).
- Fix warnings when they point at a real problem (`W_CARD_CHOICES`: split the card; `W_IMG_ALT`: add `alt`).
- A passing check writes the answer schema into `review.json` and the segments into `i18n/source.json` for the translator.

## Custom Blocks

When no component fits, a small script may render a custom block. It reads and writes answers only through `window.epicLoop`:

```html
<div id="budget"></div>
<script>
  window.epicLoop.registerControl("budget");
  // render the block, then on change:
  window.epicLoop.set("budget", 1200);
</script>
```

Keep scripts inline in the page (no network). A block needed a second time should become a component.

## Gate Summary

Return only this to the manager, nothing else (no HTML, no page text):

```
Review <review-id>: <title>
URL: <http://127.0.0.1:<port>/<slug>/reviews/<review-id>/ from `epic-loop serve --status --json`, or "server not running: run epic-loop serve --detach">
Asks: <one line on what the human decides>
Why: <one line on why it matters now>
Controls: <n> (<m> required); languages: <en, …>
Check: passed (<warnings or "no warnings">)
```
