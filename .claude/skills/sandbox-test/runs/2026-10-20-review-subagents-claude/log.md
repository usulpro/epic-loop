# Sandbox run: review page builder and translator subagents on Claude Code (2026-10-20)

Run 13 of the `sandbox-test` skill.

Questions this run answers:

- [FEATURE] Does a manager session, following the "Review Pages" section of the manager role, delegate a review page to a page builder subagent and its translation to a translator subagent on haiku, through the Agent tool?
- [FEATURE] Does the main thread keep only the subagents' summaries?
- [FEATURE] Does the result pass `review check --lang ru`, and does it render in both languages?
- [SANDBOX] Is a headless `claude -p` session enough to observe subagents?

Layout:

- Sandbox (disposable): `<workspace>/sandbox-subagents-claude/`. It is a git repo with a `demo` epic and two SVG headers in `evidence/`, and the skill installed from this worktree's source (`cli.mjs install --platform claude-code`). `EPIC_LOOP_CLI` points the skill wrapper at the local CLI, because the published 0.2.1 has no `review check`.
- Heavy artifacts: `<workspace>/sandbox-logs/2026-10-20-review-subagents-claude/artifacts/`
- Driver: `driver/run.sh`, `driver/prompt.txt`, `driver/shots.mjs` (CDP screenshots in English and Russian).

## Journal

### 1. Session

- [SANDBOX] DECISION:
  - One headless `claude -p --model sonnet --setting-sources project --permission-mode acceptEdits` session, with `--max-budget-usd 6`.
  - Allowlist: `Read Edit Write Glob Grep Agent Task Bash(node:*) Bash(cp:*) Bash(mkdir:*) Bash(ls:*) Bash(cat:*)`.
  - The prompt pre-answers everything and asks for a level-2 decision with Russian as the second language (`driver/prompt.txt`).
- [FEATURE] PASS: delegation through the Agent tool.
  - The main thread read the "Review Pages" section and both brief templates.
  - It made exactly two Agent calls:
    - "Build review page": `general-purpose`, default model, a 2,187-character filled brief;
    - "Translate review page": `general-purpose`, `model: "haiku"`, a 1,312-character brief.
  - Both were launched as background agents (`requestShape: background` in the subagent metadata). The main thread waited for the builder's notification before starting the translator.
- [FEATURE] PASS: models and order, from the subagent transcripts in `<session>/subagents/`.
  - The builder ran on `claude-sonnet-5-5` from 19:03:09 to 19:03:32. It ran `mkdir`, `cp` of both SVGs into `assets/`, and `review check` twice.
  - The translator ran on `claude-haiku-5-5` from 19:03:39 to 19:03:49. It ran `review check --lang ru`.
- [FEATURE] PASS: the main thread saw only short results.
  - Its tool results are the two templates, a grep, a glob, two "async agent launched" acknowledgements, and the task notifications carrying the summaries.
  - No page HTML and no translation text reached the main thread.
  - The final message was the two summaries:
    - `Review 2026-10-20-header-layout: Site header layout. URL: server not running: run epic-loop serve --detach. Asks: Which header layout the site uses, compact (recommended) or stacked, plus an optional free-text comment. Why: The header has to be chosen before the landing page is built. Controls: 2 (1 required); languages: en, ru. Check: passed (W_TRANSLATION_MISSING: 13 segments have no ru translation yet, for the translator to fill).`
    - `Translated 13 segments into ru; check passed.`
- [FEATURE] PASS: the page follows the content rules.
  - It has one card with both screenshots inside it (`el-shot`, assets copied).
  - It has a choice with consequences in each `note`, `recommended="compact"` with a rule, and an optional comment outside the card.
  - `review check demo/2026-10-20-header-layout --lang ru --json` returned `ok: true` with 2 controls, 13 segments, 0 missing and 0 stale (`artifacts/05-check-ru.json`).
- [FEATURE] PASS: the page is served.
  - `epic-loop serve` served it, and the language switch applied Russian: h1 "Макет шапки сайта", card title "Какой макет шапки использовать на сайте?".
  - Screenshots: `artifacts/page-en.png`, `artifacts/page-ru.png`.
- [SANDBOX] Cost and time: about 66 s of wall time, and about $0.43 estimated from the transcripts:
  - main thread (Sonnet) $0.20;
  - builder (Sonnet) $0.18;
  - translator (Haiku) $0.05.

### 2. Findings and fixes

- [FEATURE] FINDING:
  - The builder wrote a fragment: no `<html>`/`<body>` and no `<main class="el-main">`. The server injection handles the missing head and body, but the content touches the window edges.
  - FIX (skill): `references/review-pages.md` now gives a full page skeleton with `<main class="el-main">` and a page head.
- [FEATURE] BUG:
  - The runtime shows the choice's `rule` attribute as visible text next to the recommended tag, but the check did not extract it as a segment. So `rule="Convention: mobile first, …"` stayed in English on the Russian page.
  - FIX: `rule` was added to the check's rendered attributes (`packages/cli/src/review/check.mjs`), with a test assertion that `D16` is a segment.
  - Re-running the check on the archived page now reports `E_TRANSLATION_MISSING` (1 segment) under `--lang ru`, as it should.
  - `review-pages.md` now also says to keep `rule` short.
- [FEATURE] OBSERVATION: the builder set `created` to an invented time (`09:00:00Z`). `review-pages.md` now says "the current time".
- [FEATURE] OBSERVATION: runtime UI text ("Optional.", "answered", "Submit answers") stays in English on the Russian page. This is a known limit from slice A.

### 3. Archive and cleanup

- [SANDBOX] Archived to `artifacts/`:
  - a git bundle of the sandbox after the session, restore-tested;
  - the `.epic-loop/` tree;
  - the host transcript with the `subagents/` folder;
  - the session stream, the check output and the screenshots.
- [SANDBOX] Removed the sandbox and its `~/.claude/projects/` directory. No server or Chrome processes remain. One trust entry for the sandbox path stays in `~/.claude.json`.

## Summary

- [FEATURE] Delegation works on Claude Code with only the brief templates and the Agent tool (D36):
  - the builder ran on the main model and the translator on Haiku;
  - the main thread saw only summaries;
  - the page passed the strict check and renders in Russian.
  - Two fixes came out of the run: a page skeleton in the reference, and `rule` as a translation segment.
- [SANDBOX] A headless `claude -p` session is enough. The subagents run as background agents, and their transcripts and metadata (`requestShape`, `model`) sit in `<session>/subagents/`, which is the evidence for the model check.
