# Tracker

Epic: Visual Human Interface For Epic-loop

## Task Statuses

- todo
- doing
- need-review
- blocked
- on-hold
- partially-satisfied
- deferred
- reset-required
- done

## Task Kinds

- implementation
- verification
- review
- follow-up
- architecture-reset
- documentation-only

## Active Roadmap

**Where each phase runs and how it merges: read `docs/delivery.md` first.**

Order (agreed 2026-10-18, revised the same day, D18):
- Phase 1 ships first, standalone, merged into `main`.
- Phases 2–7 run in a separate worktree (`../epic-loop-visual`, branch `feature/visual-review`) created from `main` after Phase 1 is merged.
- Phase 4 needs Phases 1–3. Phase 5 needs Phase 3. Phase 6 needs Phases 4 and 5. Phase 7 needs Phase 5 and may become a separate epic (Q8).

### Phase 0: Shape The Epic

- Phase status: done

- [x] Kind: documentation-only | Status: done | Capture problem framing, desired outcome, scope, non-scope, constraints, risks, and initial open questions.
  - Outcome: The epic has enough structure for phase and task decomposition.
  - Surface: `docs/`, `decision-log.md`, `risk-register.md`, `state-of-epic.md`.
  - Acceptance: A future session can understand why this epic exists and what should happen next.
  - Docs: `docs/problem-framing.md`, `docs/prior-art.md`, `decision-log.md`, `risk-register.md`.

### Phase 1: Manager Stop Gate And Human-Readable Stop Reports

- Phase status: done
- Delivery: main checkout, branch `feature/manager-stop-gate` from `main`, merged into `main` before the other phases (D18, `docs/delivery.md`).
- Intent: the techlead no longer stops the loop directly. Every stop passes a manager stop gate that challenges false blockers, queues deferrable questions and reorganizes work. A justified stop ends with a human-readable report against the epic's intent. Plain text first, no engine needed (D1–D3, D16, D17).

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

### Phase 2: Doorbell Spike

- Phase status: doing
- Delivery: worktree `../epic-loop-visual`, branch `feature/visual-review` (`docs/delivery.md`).
- Intent: prove, before anything is built on it, which mechanism returns the human's answers to a waiting session on its own: terminal CLI on Claude Code and Codex, across session states. Output: a support matrix and the chosen mechanism per platform (D7, D8, D19, Q2, Q3).

- [x] Kind: implementation | Status: done | Doorbell probe kit for sandbox runs
  - Outcome: a reusable probe for the sandbox with four parts:
    - a tiny local "answers server" that writes an answers file with `submittedAt` and rings a chosen mechanism;
    - waiter variants: a Claude Code `asyncRewake` hook (event-triggered and session-long), a Claude Code `run_in_background` waiter, a Codex `codex queue` caller, and the `UserPromptSubmit` fallback;
    - a probe instruction for the session under test;
    - a log of ring time, wake time, the payload the model saw, and every hook event around it.
  - Surface: `.claude/skills/sandbox-test/tools/doorbell/` (scripts, hook config snippets, the probe instruction), `LEARNINGS.md`.
  - Acceptance: one smoke run per platform in a disposable sandbox shows a ring followed by a model turn that reads the answers file, with timings in the probe log.
  - Docs: `docs/prior-art.md` ("Doorbell research"), `docs/doorbell.md`.

- [ ] Kind: verification | Status: todo | Claude Code terminal doorbell matrix
  - Method: in disposable sandboxes driven through the pty driver, ring with each Claude Code mechanism in each state:
    - idle after a finished turn;
    - mid-turn while a role works;
    - an epic-loop implementation loop chaining roles through Stop blocks;
    - after Esc;
    - after 15 minutes idle;
    - answers submitted while the session was closed, then `--resume`.
  - Tools: the probe kit, sandbox-test driver, `transcript-timeline.mjs`, `loop-watch.mjs`, progress logs.
  - Evidence (per cell):
    - a new turn started, or not;
    - latency;
    - the pointer reached the model;
    - how epic-loop hooks classified the event (not as a user abort, not as a stop);
    - no duplicate wake;
    - for `asyncRewake`: the effective timeout and the stderr size limit.
  - Cleanup: kill waiters and servers, archive the runs in the sandbox-test `runs/` log.
  - Docs: `docs/doorbell.md`.

- [ ] Kind: verification | Status: todo | Codex terminal doorbell matrix
  - Method: same states as the Claude Code matrix, in the Codex TUI.
    - Ring with `codex queue --thread "$CODEX_THREAD_ID"`, both with the shared daemon and with an embedded-server session (`-c` override).
    - Try `app-server` `thread/resume` + `turn/start` only if queue fails in a state that matters.
    - Check the minimum Codex version with `codex queue` and that queue works from inside the Codex sandbox.
  - Tools: the probe kit, sandbox-test pty/codex tooling, Codex session logs, progress logs.
  - Evidence (per cell): the same as the Claude Code matrix, plus the delay of the external-writer watcher and the after-Esc behaviour (expected: no auto-dispatch until the next completed turn).
  - Cleanup: kill waiters and servers, remove queued leftovers, archive the runs.
  - Docs: `docs/doorbell.md`.

- [ ] Kind: verification | Status: todo | Doorbell end to end in a running implementation loop, and the mechanism choice
  - Method: on each platform, bind a sandbox epic, run the implementation loop, and let a role raise a probe gate. The role ends its turn waiting. Submit answers through the probe server. Confirm the loop resumes with no chat message, then repeat once with the fallback path.
  - Tools: the probe kit, sandbox-test driver, `loop-watch.mjs`, progress logs.
  - Evidence:
    - both platforms resume without a human message;
    - the fallback resumes on any human message;
    - `docs/doorbell.md` holds the support matrix with links to run logs, the chosen mechanism per platform, the fallback rules, and the doctor checks needed (Codex version, hook options);
    - D7 and R1 are updated.
  - Cleanup: archive the runs; remove probe hooks from the sandbox fixtures.
  - Docs: `docs/doorbell.md`, `decision-log.md` (D7, D8, D19).

### Phase 3: Review Engine In The CLI

- Phase status: todo
- Intent: the npm CLI serves review pages written by agents as HTML with the engine's web components; a static check derives the answer schema and the translation segments; the manager's page-builder and translator subagents produce pages (D4–D6, D13, D20, D21).

- [ ] Kind: implementation | Status: todo | Design language for the app and review pages
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

- [ ] Kind: implementation | Status: todo | Review server with lifecycle and answers API in the npm CLI
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

- [ ] Kind: implementation | Status: todo | Page runtime and web components v1
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

- [ ] Kind: implementation | Status: todo | Static review check: schema, translation segments, safety
  - Outcome: `epic-loop review check <review>` validates a page (unique control names, local files exist, no network scripts or foreign form targets), writes the derived answer schema to `review.json`, extracts text segments to `i18n/source.json`, and reports missing or stale translations.
  - Surface: `packages/cli/src/review/check.mjs` (or similar), CLI command wiring, unit tests with good and broken fixture pages.
  - Acceptance:
    - fixtures with duplicate names, missing files, a network script, or a missing translation each fail with a clear message;
    - a valid page passes;
    - the schema matches its controls;
    - the segments are stable across reruns.
  - Docs: `docs/review-engine.md`.

- [ ] Kind: implementation | Status: todo | Page-builder and translator subagents for the manager
  - Outcome:
    - A skill reference gives the component catalog, the content rules and the proportionality ladder.
    - Two subagent briefs exist: a page builder on the main model, which takes a review request and returns a checked page plus a gate summary; and a translator on a cheap model, which fills `i18n/<lang>.json`.
    - Both are invocable by the manager on Claude Code and on Codex, and the main thread receives only the summary.
  - Surface: `references/review-pages.md`, brief templates under `assets/templates/`, a Claude Code agent definition and the Codex subagent equivalent, the manager role reference.
  - Acceptance: on each platform, a manager turn in a sandbox epic produces a checked page and its translation through the two subagents; the main transcript shows only the summary; the translator ran on the cheap model.
  - Docs: `docs/review-engine.md`, `docs/prior-art.md`.

- [ ] Kind: verification | Status: todo | Three representative review pages, built by subagents, served and answered
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

### Phase 4: Human Gates In The Loop

- Phase status: todo
- Intent: review pages, answers, the inbox and the doorbell become part of the loop. The manager opens blocking or non-blocking gates, the loop picks up answers and inbox requests at every role transition, an idle session is rung awake, and an accepted stop becomes a report page that can resume the loop on submit (D1, D7, D16, D22–D26).

- [ ] Kind: implementation | Status: todo | Gate lifecycle in the loop state
  - Outcome:
    - A manager script opens a gate for a review: the H items it covers, blocking or not.
    - The loop state lists open gates.
    - A blocking gate sets the loop status `awaiting-review` and lets the turn end.
    - `gate-opened`, `answers-submitted`, `gate-ingested` and `gate-closed` progress events are written.
    - `role-summary.mjs` and the epic home show open gates.
  - Surface: `scripts/lib/loop.mjs`, a new gate script, `role-summary`, the manager role reference and prompt, `references/implementation-cycle.md`, hook contract tests.
  - Acceptance: hook and CLI contract tests show the following:
    - a non-blocking gate leaves the loop running;
    - a blocking gate ends the turn in `awaiting-review` without a continuation;
    - only a manager turn can open a gate;
    - events are logged with the review id.
  - Docs: `docs/human-gates.md`.

- [ ] Kind: implementation | Status: todo | Answers and inbox pickup at every role transition, with manager ingest
  - Outcome:
    - On each driver Stop the loop finds submitted, un-ingested answers and new inbox entries, and routes to a manager ingest turn first.
    - The manager records answers and inbox requests into the artifacts and writes a "what changed" note.
    - The techlead plans the follow-ups.
    - Ingest is idempotent.
    - The epic home has a minimal inbox form that writes inbox entries.
    - Hold-kind rules apply: `security-hold` needs explicit confirmation; `human-action` resolves on "done"; `external-wait` is rechecked by the techlead.
  - Surface: `scripts/lib/loop.mjs`, the manager ingest prompt and role reference, the techlead role reference, the inbox endpoint and form in the CLI app, contract tests.
  - Acceptance: contract tests show the following:
    - submitted answers route the next turn to manager ingest, both while the loop runs and after a blocking gate;
    - a second pickup changes nothing;
    - an inbox entry is recorded and reaches the techlead's next prompt;
    - a `security-hold` item is not resolved by a plain submit.
  - Docs: `docs/human-gates.md`, `decision-log.md` (D22, D23, D26).

- [ ] Kind: implementation | Status: todo | Doorbell from the server, per platform, with fallback
  - Outcome:
    - On submit, a problem report or an inbox entry for an epic whose loop is idle in `awaiting-review` (or stopped with "continue after submit"), the server rings the driver session with the Phase 2 mechanism for the configured platform.
    - The fallback injects pending answers on the next human message.
    - `doctor` checks what the doorbell needs (hook options, Codex version and `codex queue`).
  - Surface: the CLI server (ring adapters per platform), skill hook config written by `install-hooks.mjs` if the chosen mechanism needs a hook, `UserPromptSubmit` handling in `scripts/lib/loop-user-prompt.mjs`, doctor checks, tests.
  - Acceptance:
    - tests show the adapter selected per platform, the ring command or hook output, and the fallback injection on `UserPromptSubmit`;
    - no ring is sent while the loop is running;
    - doctor reports a missing prerequisite.
  - Docs: `docs/human-gates.md`, `docs/doorbell.md`.

- [ ] Kind: implementation | Status: todo | Stop report and human queue on a page, with auto-continue
  - Outcome:
    - When the manager accepts a stop, the page builder produces a report page: the report against the epic intent, the open H items with controls, the agent-made decisions with confirm/reverse, and the "continue after submit" switch (on by default).
    - The chat message is a short summary with the deep link.
    - On submit with the switch on and work unblocked, the loop resumes with no chat message; with the switch off, it records and stays paused.
    - Problem reports lead to a fixed page and a new link.
  - Surface: the manager stop-report flow from Phase 1 (moved onto a page), the page-builder request for reports, loop resume path after ingest, contract tests.
  - Acceptance:
    - contract tests show resume after an ingest that unblocks work with the switch on, and no resume with the switch off;
    - the report page passes the static check and covers every open H item and unconfirmed agent decision.
  - Docs: `docs/human-gates.md`, `docs/stop-gate.md`.

- [ ] Kind: verification | Status: todo | Human gates end to end on Claude Code and Codex
  - Method: a sandbox fixture epic runs the loop unattended on each platform. The human side is played by browser MCP from the verifying session. Scenarios:
    1. a non-blocking gate answered while the loop keeps working;
    2. a blocking gate whose submit rings the idle session and the loop resumes;
    3. a stop report page submitted with the switch on (resumes) and off (stays paused);
    4. a reversed agent-made decision that the techlead turns into rework;
    5. a `security-hold` that is not resolved by a plain submit;
    6. an inbox request sent mid-loop and picked up at the next transition;
    7. a problem report that leads to a fixed page.
  - Tools: sandbox-test driver, browser MCP, `loop-watch.mjs`, progress logs, `role-summary.mjs`.
  - Evidence (per scenario):
    - progress events;
    - artifact changes (`decision-log.md`, the human queue, tracker statuses);
    - no human chat message needed in scenarios 1–3 and 6–7;
    - screenshots of the pages.
  - Cleanup: stop servers, archive the runs.
  - Docs: `docs/human-gates.md`.

### Phase 5: Epic Viewer

- Phase status: todo
- Intent: the epic home grows into the full overview, shared by shaping and implementation (D9, D10, D17, D24, D27, D28, D30):
  - loop state, what waits for the human, unconfirmed agent-made decisions, phases and tasks;
  - live activity and turn statistics;
  - docs browsing with working links and expandable ids;
  - presentation-layer localization.

- [ ] Kind: implementation | Status: todo | Stable task ids and canonical references
  - Outcome:
    - Every task in `tracker.md` carries a stable `T<n>` id; all roadmap scripts read and write it; existing epics are migrated deterministically on first use.
    - Decisions, queue items, risks and open questions follow the canonical `D<n>`/`H<n>`/`R<n>`/`Q<n>` form.
    - A script builds an id index of the epic for the viewer.
  - Surface: `scripts/lib/roadmap.mjs` and the task scripts, `render-tracker`, `init-epic`, the epic compatibility repair in `doctor`, `references/artifact-model.md`, contract tests.
  - Acceptance: contract tests show the following:
    - ids are assigned once and never reused;
    - migration of a fixture epic without ids is stable on rerun;
    - start/close/status scripts accept `T<n>`;
    - the index resolves every id kind, including the hyphenated form.
  - Docs: `decision-log.md` (D27).

- [ ] Kind: implementation | Status: todo | Epic home as the live overview
  - Outcome: `/<slug>` shows the following, and updates live through server-sent events when epic files change:
    - the epic title and intent;
    - mode and loop state (running, waiting for the human, stopped);
    - the current phase, task and role with elapsed time;
    - what waits for the human (open reviews, holds by kind, external waits);
    - unconfirmed agent-made decisions;
    - phases and tasks with progress and expandable details.
  - Surface: the CLI app (home route, file watching, SSE), components from the Phase 3 design language.
  - Acceptance: against a fixture epic, changing a task status, opening a gate or recording an agent-made decision updates the open home page within seconds without reload.
  - Docs: `docs/review-engine.md` (app and routes).

- [ ] Kind: implementation | Status: todo | Activity feed: what the agent is doing now, and turn statistics
  - Outcome:
    - The home shows the driver session's recent activity: tool calls and messages, condensed, read from the Claude Code transcript or the Codex rollout, with no model involved.
    - It also shows turn history and statistics from the progress log: durations per role, phase and task, waits, aborted turns.
  - Surface: the CLI app (activity readers per platform, feed view), the session's transcript path recorded at bind time.
  - Acceptance: with a running sandbox loop on each platform, the feed shows the current role's latest actions within seconds, and the statistics match `progress-report.md`.
  - Docs: `docs/review-engine.md`.

- [ ] Kind: implementation | Status: todo | Docs browser and reference expansion
  - Outcome:
    - Every epic doc and artifact renders as a page with working relative links.
    - Any `D<n>`, `H<n>`, `T<n>`, `R<n>`, `Q<n>` (or the hyphenated form) in any page expands on hover or click to its entry, with a link to its source.
  - Surface: the CLI app (markdown rendering, id index from the stable-ids task, expansion component).
  - Acceptance: on this epic's own artifacts, every relative link resolves and every id mention expands to the right entry.
  - Docs: `decision-log.md` (D27).

- [ ] Kind: implementation | Status: todo | Presentation-layer localization of epic content
  - Outcome:
    - A language switch shows epic docs, artifacts and the home in the second language.
    - Translation runs in a background headless process on a cheap model (Claude Code or Codex, per the platform), never in an agent session.
    - The cache is keyed by content hash under `.runtime/`.
    - The second language comes from the epic config set by the manager.
    - Files on disk stay English.
  - Surface: the CLI server (translation runner and cache), the epic config field and the manager instruction that sets it, the app's language switch.
  - Acceptance:
    - switching language on a fixture epic produces translated pages;
    - a second switch is served from the cache with no new model call;
    - editing a doc invalidates only that doc's entry.
  - Docs: `decision-log.md` (D9, D28).

- [ ] Kind: verification | Status: todo | Viewer on a live loop and on a real epic, with design and accessibility review
  - Method:
    - Run the viewer against a sandbox loop on each platform, and against this epic's own artifacts.
    - Through browser MCP, check the following: live updates as the loop moves, the activity feed, waiting items and agent-made decisions, docs links, id expansion, the language switch with cache hits, and dark and light themes from the OS setting.
    - Then run a design critique and an accessibility review with the design skills on the home, a docs page and a review page.
  - Tools: sandbox-test driver, browser MCP, `epic-loop serve`, the design-critique and accessibility-review skills.
  - Evidence:
    - screenshots in both themes and both languages;
    - a timing note for live updates;
    - the critique and accessibility findings, with fixes applied or recorded as follow-ups.
  - Cleanup: stop servers, archive the runs.
  - Docs: `decision-log.md` (D30).

- [ ] Kind: review | Status: todo | Open the visual-layer pull request and stop for the human's merge
  - Outcome: a pull request from `feature/visual-review` to `main` covering Phases 2–5, with links to each phase's verification runs. Unit tests and `validate` pass on the branch. The loop stops so the human can review and merge.
  - Surface: git branch in the worktree, GitHub pull request, `state-of-epic.md`.
  - Acceptance: the PR URL is recorded in `state-of-epic.md` and `implementation-log.md`; the agent has not merged, pushed to `main`, or published.
  - Docs: `docs/delivery.md`.

### Phase 6: Discuss The Epic Without Interrupting The Loop

- Phase status: todo
- Intent: a chat panel in the app backed by a separate read-only agent session that sees the epic artifacts and the loop activity. A "send to inbox" control passes a resulting change to the loop (D22, D29).
- Tasks: to be shaped.

### Phase 7: Shaping Tools

- Phase status: todo
- Intent: quote any doc fragment and iterate on it next to the doc; a more template-based shaping interface (Q8). May move to a separate epic.
- Tasks: to be shaped.

## Follow-Up Tasks

- [x] Kind: follow-up | Status: done | Show stop-gate events in the sandbox-test loop-watch tool
  - Outcome: tools/loop-watch.mjs prints stop-gate events (class, outcome, round, report path) like other loop events.
  - Surface: .claude/skills/sandbox-test/tools/loop-watch.mjs
  - Acceptance: A sandbox Monitor on loop-watch shows each stop review outcome without reading progress-log.jsonl by hand.
