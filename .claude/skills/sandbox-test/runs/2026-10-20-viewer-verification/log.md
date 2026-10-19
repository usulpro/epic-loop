# Sandbox run: the epic viewer on live loops and on this epic (2026-10-20)

Run 17 of the `sandbox-test` skill. Phase 5 Task 6 of the `visual-review` epic.

Questions this run answers:

- [FEATURE] Does the epic app hold up against a live Claude Code loop?
  - The home updates live as the role and task change, and the activity feed shows new tool calls. How long is the delay from a transcript write to its item on the page?
  - The skill records `implementation_loop.driver_transcript_path`.
  - The turn statistics match `progress-report.md`.
  - Waits and decisions show; doc links resolve; id popovers open.
  - The RU switch translates a doc and the home with the real cheap model, and a second visit is a cache hit.
  - The themes follow `prefers-color-scheme`.
- [FEATURE] On Codex, without `danger-full-access`: is `driver_transcript_path` recorded from Codex hook payloads, does the feed show a live rollout, and do the statistics update?
- [FEATURE] On this epic's own artifacts (a migrated copy): do every page, link and id work, and do the translations?
- [FEATURE] A design critique and an accessibility review of the home, a doc page and a review page.
- [SANDBOX] Can a CDP watcher run beside a live interactive loop for the whole run, with the session ending on the watcher's marker?

Layout:

- Sandboxes (disposable): `<workspace>/sandbox-viewer-claude/`, `<workspace>/sandbox-viewer-codex/`, `<workspace>/sandbox-viewer-epic/`.
- Heavy artifacts: `<workspace>/sandbox-logs/2026-10-20-viewer-verification/artifacts/<cell>/` (screenshots, saved HTML, transcripts, rollouts, logs).
- Fixture: `<workspace>/sandbox-logs/2026-10-20-viewer-verification/fixture`, built by `driver/make-fixture.sh` from the run 12 "mini" base commit.
  - It is a pre-shaped 4-task epic (D-12) with T ids: three one-line helpers and a verification task.
  - It has H1 (a human action that blocks no Phase 1 task), the unconfirmed agent-made decision D1, `docs/notes.md` citing ids and linking other docs, a static review page `reviews/2026-10-20-package-name/`, and `Second language: ru`.
  - Every item is written by the worktree's own scripts.
- Driver (`driver/`):
  - `run.sh` (Claude Code) and `run-codex.sh`;
  - `make-steps.mjs`;
  - `viewer-check.mjs`: CDP, two tabs, outside the session;
  - `codex-check.mjs`;
  - `epic-check.mjs`;
  - `reap.mjs` and `make-fixture.sh`.

## Journal

Tag every entry [FEATURE] or [SANDBOX]. Use PASS / FAIL / FINDING / BUG / FIX / DECISION / WORKAROUND / LESSON / OBSERVATION.

### 1. Roll-out

- [SANDBOX] DECISION: the Claude Code cell follows run 16 (D-11, D-20):
  - an interactive `claude --model sonnet --setting-sources project --permission-mode dontAsk` session through `ptydrive.py`, with epic-loop installed from source and `EPIC_LOOP_CLI` set;
  - the server is started by the driver;
  - `viewer-check.mjs` runs in the background from the start and writes `viewer-done.txt` when done, and the steps then send `stop loop mode`.
- [SANDBOX] DECISION: the real translator runs on the user's Claude Code login (`claude -p --model haiku`) from the server. This is the cheap model; it costs cents.
- [SANDBOX] The fixture is `eeb9d17` in `sandbox-logs/.../fixture`. The Codex cell (`run-codex.sh`) and the this-epic cell (`run-epic.sh`) ran in parallel with the Claude Code cell, each with its own sandbox and server.

### 2. Checks without an agent

- **Part 3 (this epic's artifacts)**, on a migrated copy (`run-epic.sh`, `epic-links.mjs`, `epic-check.mjs`):
  - [FEATURE] PASS:
    - The copy migrated to T ids, and `set-second-language.mjs` wrote `ru`.
    - 14 doc pages rendered. 362 internal links and 259 anchors resolved with 0 failures. 259 id references point at the right definitions.
    - The index holds 97 ids with 0 duplicates; the only unknown id is `T0`.
    - The home renders the epic with 20 tasks and 57 id links.
  - [FEATURE] PASS, translation with real haiku:
    - `docs/review-engine.md` (19.5 KB) in 34.5 s;
    - `state-of-epic.md` in 6.7 s;
    - the home in two batches, 150 segments in 19.1 s and 11 in 3.7 s;
    - all jobs validated, and a revisit was a cache hit.
  - [SANDBOX] Two FAIL lines were checker mistakes, not product findings: "> 20 tasks" against exactly 20, and the title check on `state-of-epic.md`.
  - [FEATURE] FINDING (minor, quality): haiku left Title Case headings ("State Of Epic", "Read First") in English.
    - FIX: both prompts now ask to translate every heading and title, including short Title Case ones. The prompt version goes to 2, which invalidates the cache.
    - Real check: both headings now come back in Russian (the equivalents of "Epic state" and "Read this first").
- **Accessibility** (`a11y-check.mjs`, both themes, on a served fixture copy):
  - [FEATURE] PASS on the home, a doc page and a review page:
    - WCAG AA contrast: 0 text nodes below the threshold;
    - every Tab stop has a visible focus change (39 stops per page);
    - one `main`, `nav aria-label="Breadcrumb"`, one `h1`;
    - no unnamed links or controls;
    - the language switch is in the tab order;
    - focus on an id opens its popover and Escape closes it;
    - Enter toggles a `<details>`;
    - the inbox textarea has a label.
  - [FEATURE] FINDING (minor): the review page jumps from h1 to h3, because the card titles are h3 with no h2. This is in the Phase 3 review runtime.
  - [SANDBOX] LESSON: `cdp.mjs` `key("Enter")` sends keyCode 69 ('E'), so the first a11y pass reported a false "Enter does not open details". The checker now dispatches keyCode 13.

### 3. Headless agent sessions

- **Codex** (`run-codex.sh`, `gpt-5.6-sol` at low effort, `workspace-write`, `--ignore-user-config`):
  - [FEATURE] PASS:
    - the skill recorded `driver_transcript_path` from the Codex hook payloads (the rollout under `~/.codex/sessions/...`) 21 s after the start;
    - the activity feed showed 58 items from the live rollout (21 tool, 21 result, 15 message, 1 turn), with a median delay of 0.79 s from the rollout timestamp to `?fragment=activity`, polled once a second;
    - the statistics matched `progress-report.md` in all 291 polls (4m 52s active, 3 completed).
  - [FEATURE] The watchdog stopped the session after 3 `turn-stop` events (manager, techlead, engineer). No commit was attempted before it; `danger-full-access` was never used.
  - Tokens: 1,040,175 in total, 990,336 of them cached input.
  - [FEATURE] FINDING: Codex delivers a Stop-hook continuation as a user message wrapped in `<hook_prompt …>`, and the feed showed it raw.
    - FIX: the Codex reader shows it as a `turn` item, "role prompt: …", with a fixture line and test.
  - [FEATURE] FINDING (design): tool summaries showed absolute sandbox paths.
    - FIX: the feed drops the project root (`readEpicActivity`), with a test.
- **Claude Code** (`run.sh`, sonnet, interactive through ptydrive). Each attempt stopped on the watcher's marker with `stop loop mode`.
  - Attempt 1 [SANDBOX] BUG in the checker: the feed item key included the ticking relative time, so the same item was counted again every second (224 "items", a 17 s "median"). It now keys by time, kind and text.
  - Attempt 2 [FEATURE] still had a median of about 6 s, and the second tab backgrounded the home tab. Attempt 3 kept the home tab in front and timed tool results (which land on disk about 0.1 s after their timestamp): still 4.7 s.
  - [FEATURE] Diagnosis:
    - A 60-second probe of this session's own transcript showed write lags of 0.1–4.6 s. A tool line is written when its message completes; a result is written about 0.1 s after its timestamp.
    - An interactive haiku probe through the full server pipeline gave 0.26–0.41 s.
    - Replaying attempt 3's transcript at the SSE level gave a median of 0.34 s.
    - But the feed items arrived in batches exactly at turn boundaries.
    - Attempt 4 logged every SSE event: 0 `activity` events while the transcript grew 42 times, and only one `change` for `runtime-state.json`.
  - [FEATURE] BUG (product, major): the event stream used Node's recursive `fs.watch`, which on Linux follows files by inode.
    - The skill writes `runtime-state.json` atomically (tmp, then rename). After the first replacement the watcher went silent for that file, so a `driver_transcript_path` recorded by a later hook never re-armed the transcript watch.
    - The live feed then moved only when other files changed. It was reproduced with the real skill scripts: `init-epic`, then the stream, then `SessionStart`, bind, `UserPromptSubmit`.
  - [FEATURE] FIX (`packages/cli/src/serve/events.mjs`):
    - one non-recursive watcher per epic directory, skipping `hook-events`, `sessions` and `engineer-briefs`; it is re-synced on rename events, and files already present in a new directory are reported;
    - the transcript is watched through its directory;
    - a 2 s re-read of the transcript path as a safety net.
    - Regression test `tests/unit/epic-events-live.test.mjs` runs the real skill sequence. It fails on the old code and passes on the new.
- Attempt 5 (with the fix) [FEATURE] PASS on every check:
  - **Feed delay:** for tool results, the median from the transcript write to the item on the page is 427 ms, p90 2.4 s and worst 6.0 s, over 29 samples, with 56 `activity` events. Tool calls and assistant messages arrive later than their timestamps only because the host writes them when the message completes.
  - The live home showed manager, techlead and engineer, and T1 todo → doing → done.
  - The statistics matched `progress-report.md` on the first attempt.
  - H1 and D1 showed, the notes links resolved to their anchors, and the D1 popover showed its title.
  - The RU switch translated the notes doc in 6.8 s and the home labels in 15.6 s with real haiku; a second visit was a cache hit.
  - Themes followed the emulated `prefers-color-scheme` with no `data-theme`: background `rgb(245, 244, 239)` in light and `rgb(18, 18, 16)` in dark.
  - The review page wrapped 6 ids.
- [FEATURE] FINDING from the attempt 5 screenshot of tab 1: the language had been switched in the other tab (the cookie is shared), so live fragments came in Russian while the header switch and `<html lang>` still said EN.
  - FIX: home and doc responses send `Content-Language` with the chosen language, and `home.js` reloads when it differs from the page's switch, with a server test and a browser-check case.
- [FEATURE] FIX (minor): assistant messages in the feed drop `**` markers.

### 4. Fixes

All fixes are in this worktree, not committed (the loop's techlead commits):
- `packages/cli/src/serve/events.mjs`: directory watchers instead of recursive `fs.watch`; the transcript watched through its directory; a rearm interval; files reported in newly watched directories.
- `packages/cli/src/epic/activity.mjs`: Codex `<hook_prompt>` as a turn item; summaries relative to the project root; plain messages.
- `packages/cli/src/serve/translator.mjs`: prompt version 2, with headings and imperative action labels.
- `packages/cli/src/serve/home.mjs`: inline code in the intent and task details; the header badge labeled "pending reviews".
- `packages/cli/src/serve/server.mjs`: `Content-Language`.
- `packages/cli/src/review/runtime/home.js`: reload on a language change.
- Tests: `tests/unit/epic-events-live.test.mjs` (new), `activity.test.mjs`, `epic-i18n.test.mjs` and the Codex fixture; the `browser-check.mjs` cross-tab case.
- `pnpm run test:unit` 272/272, `pnpm run validate` passed, the build passed, `browser-check` all passed. The timing-sensitive files ran three times clean.

### 5. Archive and cleanup

- Archived under `artifacts/<cell>/90-archive/`:
  - git bundles, restore-tested with `npm test`: Claude 4 tests, Codex 1 test (it stopped before its first task commit);
  - the `.epic-loop/` trees;
  - the Claude host transcripts of all five attempts;
  - the Codex rollout.
- The flush probes' data is in `artifacts/flush-probe/`.
- Removed: the sandboxes `sandbox-viewer-{claude,codex,epic,flush}`, their Claude project directories, and the scratch copies. Every server stopped through `serve --stop`, and the reaper found nothing; no process is left.
- Kept on purpose: the Codex rollout under `~/.codex/sessions/2026/10/20/`, which is the user's session store and is not touched. `~/.claude.json` may list the sandbox paths; it is global config, so it is left alone.
- Cost:
  - Claude Code sonnet, five attempts, estimated from the transcripts' usage: $1.02, $0.94, $1.14, $1.04, $1.53, about $5.67 in total;
  - the haiku translations: cents;
  - Codex: 1,040,175 tokens, 990,336 of them cached input.

## Summary

### [FEATURE]

- **Verdict:** the epic viewer works end to end on a live Claude Code loop, against a live Codex rollout, and on this epic's 14 docs.
- **Bugs this run found and fixed:**
  - **Major:** recursive `fs.watch` lost atomically replaced files, so the live feed never armed after a bind.
  - **Fixed:** Codex hook prompts shown raw, absolute paths in the feed, Title Case headings and action labels translated poorly, and a cross-tab language mix.
- **Proposed follow-ups (minor):**
  - the review page heading levels (h1 → h3);
  - the `role` value on the home is not translated;
  - the docs index page and the header labels stay English;
  - an `el-ref` link's accessible name is only the id;
  - review pages have no breadcrumb back to the home.

### [SANDBOX]

- **What worked:**
  - a CDP watcher started by the launcher beside the interactive loop, with the ptydrive steps gated on its marker file;
  - a model-free reproduction with the real skill scripts once the SSE log pointed at the server.
- **What didn't:** three of the first four attempts measured the checker or the host. The fixes are now D-21: stable keys, a single foreground tab, timing by result items, and an SSE log.
- **Codex without `danger-full-access`:** a capped `workspace-write` cell answers read-side questions (D-22).
