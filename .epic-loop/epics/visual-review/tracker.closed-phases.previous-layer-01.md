# Tracker: archived task lists of closed phases (previous layer 01)

Archived from `tracker.md` during Phase 3 closure housekeeping (2026-10-20). The phase headers, status and intent stay in `tracker.md`; this file keeps the closed task lists as they were.

### Phase 0: Shape The Epic

- [x] Kind: documentation-only | Status: done | Capture problem framing, desired outcome, scope, non-scope, constraints, risks, and initial open questions.
  - Outcome: The epic has enough structure for phase and task decomposition.
  - Surface: `docs/`, `decision-log.md`, `risk-register.md`, `state-of-epic.md`.
  - Acceptance: A future session can understand why this epic exists and what should happen next.
  - Docs: `docs/problem-framing.md`, `docs/prior-art.md`, `decision-log.md`, `risk-register.md`.

### Phase 1: Manager Stop Gate And Human-Readable Stop Reports

- [x] Kind: implementation | Status: done | Route every techlead stop through a manager stop review
  - Outcome:
    - The techlead can no longer set `idle`. It runs a stop request with a class (A–F), a reason and what the stop blocks, and the next role becomes the manager in stop-review mode.
    - The manager may set `idle` only after accepting a stop; otherwise it returns control to the techlead with an instruction.
    - A user stop (`stop-loop.mjs`, `stop loop mode`) is unchanged and final.
  - Surface: `scripts/lib/loop.mjs` (role transitions), `set-next-role.mjs` (reject `idle` from a techlead turn with a pointer to the stop request), a new stop-request script, `assets/templates/implementation-manager-prompt.md` and the techlead prompt, `references/implementation-cycle.md`, the manager and techlead role references, `tests/unit/hook-contracts.test.mjs`.
  - Acceptance: hook and CLI contract tests show the following, on both platform configs:
    - `set-next-role --role idle` in a techlead turn is refused;
    - a stop request routes to a manager turn whose prompt carries the class and reason;
    - the manager can end the loop only after a stop review;
    - a challenged stop returns to the techlead with the instruction in its prompt;
    - every review writes a `stop-gate` progress event.
  - Docs: `docs/stop-gate.md`, `decision-log.md` (D1, D16).

- [x] Kind: implementation | Status: done | Agent-made decisions and the human queue as scripted epic artifacts
  - Outcome:
    - A script records a class C decision in `decision-log.md` with a stable `D<n>` id and an "agent-made" marker (D17).
    - A script adds, lists and resolves human-queue items in one human-facing file, with stable `H<n>` ids, a hold kind (D26), the question or action, the default, and what each item blocks.
    - A new task status `on-hold` with `Hold: <kind> (H<n>)` is set and cleared by the task-status script; `blocked` is kept for technical blockers.
    - Task and phase scripts edit `tracker.md` in place and re-read it on every call, so hand-shaped trackers keep their detail (D31, agent-made).
    - `role-summary.mjs` shows the open human-queue items and the agent-made decisions not yet confirmed.
  - Surface: new scripts under `scripts/`, `scripts/lib/` (decision and queue helpers), `references/artifact-model.md`, `init-epic.mjs` (the queue file in new epics), unit tests.
  - Acceptance: CLI contract tests show the following:
    - ids stay stable when entries are added or resolved;
    - `on-hold` requires a valid kind and an existing H id;
    - the files render deterministically;
    - `role-summary` lists open items and unconfirmed agent decisions;
    - existing epics without the new file keep working.
  - Docs: `docs/stop-gate.md`, `decision-log.md` (D17).

- [x] Kind: implementation | Status: done | Manager stop-review rules for classes A–F
  - Outcome: in a stop-review turn the manager applies D16:
    - A is accepted;
    - B and F continue on independent work and queue the item, or are accepted when nothing independent is left;
    - C, D and E are challenged with a concrete instruction;
    - there is one challenge round, and A, B and F are never overridden.
  - Surface: the manager role reference and prompt template (stop-review section), the techlead role reference (stop-request classes, what to do after a challenge).
  - Acceptance: each class has one scripted fixture case in which a stop request reaches a stop-review turn; the manager's outcome and instruction match D16 in each case (run as part of the phase verification task).
  - Docs: `docs/stop-gate.md`, `decision-log.md` (D16).

- [x] Kind: implementation | Status: done | Human-readable stop report from the manager
  - Outcome:
    - When the manager accepts a stop, its final message is a report measured against the epic's intent: goals vs. state, outcomes since the last report, why it stopped, what the human must do or decide (human queue, with defaults), agent-made decisions to confirm, and how to resume.
    - The chat message is in the user's language. An English copy is saved in the epic and recorded as the manager report.
  - Surface: the manager prompt template (report section), the manager role reference, the report-saving path in `scripts/lib/loop-artifacts.mjs` if a new location is needed.
  - Acceptance: in the phase verification runs, each accepted stop produces such a report. A checklist review of the saved copies against `docs/stop-gate.md` "Stop Report" passes.
  - Docs: `docs/stop-gate.md`, `docs/problem-framing.md`.

- [x] Kind: implementation | Status: done | Close the stop-gate gaps found in the Claude Code sandbox run
  - Outcome:
    - A task that needs the human's hands, authority or a product decision always goes through a stop request, even when independent work is left; it is never marked `blocked`, and after the review it is `on-hold` with the H item the manager queued.
    - The manager commits each accepted stop's report and the queue changes of that review (D32).
  - Surface: the techlead prompt and role reference, the stop-review prompt and the manager role reference, prompt contract tests.
  - Acceptance: prompt contract tests show both rules; a fresh Claude Code sandbox run shows a mid-loop B request challenged with independent work left, the task `on-hold` with its H id, and every stop report committed.
  - Docs: `docs/stop-gate.md`, `decision-log.md` (D16, D23, D26, D32), `.claude/skills/sandbox-test/runs/2026-10-18-stop-gate-claude/log.md`.

- [x] Kind: implementation | Status: done | Make the techlead record its own defaults with the agent-decision script
  - Outcome: whenever the techlead takes a reasonable default itself (class C, with or without a stop request), it records it with `agent-decision.mjs add`, never by hand-editing `decision-log.md`, so `role-summary` and the stop report list it for confirmation.
  - Surface: the techlead prompt template and role reference, prompt contract tests.
  - Acceptance: a contract test shows the rule in the techlead prompt; the next Codex sandbox run lists its agent-made decisions through `agent-decision.mjs list`.
  - Docs: `decision-log.md` (D17), `.claude/skills/sandbox-test/runs/2026-10-18-stop-gate-codex/log.md`.

- [x] Kind: verification | Status: done | Prove the stop gate end to end in sandbox runs on Claude Code and Codex
  - Method: use `.claude/skills/sandbox-test`. Build a fixture epic whose tasks trigger each stop class:
    - A, the last task;
    - B, a step that needs a manual publish, plus an independent task;
    - C, a contract choice with an obvious default;
    - D, a required port held by a foreign process;
    - E, a task ordered before its dependency;
    - F, a product choice with no default that blocks all remaining work.

    Run the implementation loop unattended on both platforms.
  - Tools: the sandbox-test driver, `loop-watch.mjs`, `state-history.mjs`, the progress logs, `role-summary.mjs`.
  - Evidence (per class):
    - the `stop-gate` events with their outcomes;
    - the loop continued for B, C, D and E, and stopped only for A and F (and for B once nothing independent was left);
    - the C decision appears in `decision-log.md` marked agent-made;
    - the B item appears in the human queue;
    - the final report satisfies the stop-report checklist.
  - Cleanup: archive the sandbox runs under the sandbox-test `runs/` log; kill the foreign port holder.
  - Docs: `docs/stop-gate.md`.
  - Result: Claude Code passed the full scenario in runs 5 and 6 (after the fixes in `f752633`); Codex passed the role mechanics in runs 7 (partial: B and D challenges, Stop-hook chaining) and 8 (minimal: B challenge, on-hold, accepted stop with a committed report). Logs: `.claude/skills/sandbox-test/runs/2026-10-18-stop-gate-*/log.md`.

- [x] Kind: review | Status: done | Open the Phase 1 pull request and stop for the human's merge
  - Outcome: a pull request from `feature/manager-stop-gate` to `main` with a summary of the stop gate, the human queue, the hold kinds and the stop report, plus links to the verification runs. Unit tests and `validate` pass on the branch. The loop stops so the human can review and merge.
  - Surface: git branch, GitHub pull request, `state-of-epic.md`.
  - Acceptance: the PR URL is recorded in `state-of-epic.md` and `implementation-log.md`; the agent has not merged, pushed to `main`, or published.
  - Docs: `docs/delivery.md`.

### Phase 3: Review Engine In The CLI

- [x] Kind: implementation | Status: done | Design language for the app and review pages
  - Outcome: a design system made with a design skill (design system first, D30) and used by every later UI task:
    - tokens for colour, type, spacing and motion;
    - dark and light themes chosen from the OS;
    - the look of the app shell, cards, controls, lightbox, tables, comparison viewers and notifications.

    The style is elegant and minimal, avoids SaaS / AI clichés, and may borrow a restrained TUI feel.
  - Surface: `packages/cli/src/review/runtime/` styles and tokens, a short design reference in the skill for page builders.
  - Acceptance:
    - a static specimen page shows every token and component state in both themes;
    - a design critique with the design skill finds no blocking issues;
    - colour contrast passes WCAG AA in both themes.
  - Docs: `decision-log.md` (D30), `docs/review-engine.md`.

- [x] Kind: implementation | Status: done | Review server with lifecycle and answers API in the npm CLI
  - Outcome:
    - `epic-loop serve` serves the epic app (D24): a home page per epic listing pending reviews as notifications with a count, and review routes with deep links. It also serves every epic's `reviews/<id>/` on a dynamic `127.0.0.1` port, with `--detach`, `--status` and `--stop`, a pidfile and the port in `.epic-loop/.runtime/server.json`.
    - Answers are saved with per-control merges, `submit` sets `submittedAt`, `problem` appends to `problems.jsonl`; all writes are atomic.
    - The runtime and the "something is wrong" button are injected into every page.
  - Surface: `packages/cli/src/` (new serve module), the CLI build, `tests/unit/cli-package.test.mjs` and new server tests.
  - Acceptance: tests start the server in a temp project and check:
    - detach/status/stop and the pidfile;
    - a second `serve` reuses the running server;
    - static files are served and path traversal is refused;
    - two clients patching different controls both persist;
    - submit and problem write the expected files;
    - the problem button is present on a page whose own script throws.
  - Docs: `docs/review-engine.md`.

- [x] Kind: implementation | Status: done | Page runtime and web components v1
  - Outcome: pages built from the v1 components work with no build step:
    - choice, checkbox, comment, select;
    - shot with group lightbox and side panel;
    - iframe, table, diagram (bundled Mermaid), compare (side/overlay/flip/widths), links, card/section.
  - Also: autosave with status, submit bar with progress, light/dark theme, language switch, navigation. Custom blocks use the runtime answers API.
  - Surface: `packages/cli/src/review/runtime/` (components, runtime script and styles), bundled with the CLI.
  - Acceptance:
    - a fixture page using every component loads offline from the server;
    - answers from each control reach `answers.json`;
    - reload restores them;
    - the language switch applies a fixture `i18n/<lang>.json`.

    Checked by tests where possible and by the phase verification otherwise.
  - Docs: `docs/review-engine.md`.

- [x] Kind: implementation | Status: done | Static review check: schema, translation segments, safety
  - Outcome: `epic-loop review check <review>` validates a page (unique control names, local files exist, no network scripts or foreign form targets), writes the derived answer schema to `review.json`, extracts text segments to `i18n/source.json`, and reports missing or stale translations.
  - Surface: `packages/cli/src/review/check.mjs` (or similar), CLI command wiring, unit tests with good and broken fixture pages.
  - Acceptance:
    - fixtures with duplicate names, missing files, a network script, or a missing translation each fail with a clear message;
    - a valid page passes;
    - the schema matches its controls;
    - the segments are stable across reruns.
  - Docs: `docs/review-engine.md`.

- [x] Kind: implementation | Status: done | Page-builder and translator subagents for the manager
  - Outcome:
    - A skill reference gives the component catalog, the content rules and the proportionality ladder.
    - Two subagent briefs exist: a page builder on the main model, which takes a review request and returns a checked page plus a gate summary; and a translator on a cheap model, which fills `i18n/<lang>.json`.
    - Both are invocable by the manager on Claude Code and on Codex, and the main thread receives only the summary.
  - Surface: `references/review-pages.md`, brief templates under `assets/templates/`, a Claude Code agent definition and the Codex subagent equivalent, the manager role reference.
  - Acceptance: on each platform, a manager turn in a sandbox epic produces a checked page and its translation through the two subagents; the main transcript shows only the summary; the translator ran on the cheap model.
  - Docs: `docs/review-engine.md`, `docs/prior-art.md`.

- [x] Kind: verification | Status: done | Three representative review pages, built by subagents, served and answered
  - Method: in a sandbox epic, on each platform, have the manager request three pages:
    - a stop report with a human queue;
    - a decision between options with screenshots and a live iframe;
    - a before/after comparison.

    Then check each page, serve it, open it in a browser through Chrome or Playwright MCP from the verifying session, answer every control, switch the language, submit, press the problem button, and reload.
  - Tools: sandbox-test driver, `epic-loop serve` and `review check`, browser MCP, the answers and problem files.
  - Evidence:
    - screenshots of each page in both languages;
    - `answers.json` with every control and `submittedAt`;
    - a `problems.jsonl` entry;
    - check output;
    - the main transcript shows only subagent summaries.
  - Cleanup: `epic-loop serve --stop`; archive the runs.
  - Docs: `docs/review-engine.md`.
