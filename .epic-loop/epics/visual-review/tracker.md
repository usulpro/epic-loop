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

- Tasks: 1 closed task archived to `tracker.closed-phases.previous-layer-01.md`. Read it only if you need this phase's task-level closure context.

### Phase 1: Manager Stop Gate And Human-Readable Stop Reports

- Phase status: done
- Delivery: main checkout, branch `feature/manager-stop-gate` from `main`, merged into `main` before the other phases (D18, `docs/delivery.md`).
- Intent: the techlead no longer stops the loop directly. Every stop passes a manager stop gate that challenges false blockers, queues deferrable questions and reorganizes work. A justified stop ends with a human-readable report against the epic's intent. Plain text first, no engine needed (D1–D3, D16, D17).

- Tasks: 8 closed tasks archived to `tracker.closed-phases.previous-layer-01.md`. Read it only if you need this phase's task-level closure context.

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

- [x] Kind: verification | Status: done | Claude Code terminal doorbell matrix
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

- [x] Kind: verification | Status: done | Codex terminal doorbell matrix
  - Method: same states as the Claude Code matrix, in the Codex TUI.
    - Ring with `codex queue --thread "$CODEX_THREAD_ID"`, both with the shared daemon and with an embedded-server session (`-c` override).
    - Try `app-server` `thread/resume` + `turn/start` only if queue fails in a state that matters.
    - Check the minimum Codex version with `codex queue` and that queue works from inside the Codex sandbox.
  - Tools: the probe kit, sandbox-test pty/codex tooling, Codex session logs, progress logs.
  - Evidence (per cell): the same as the Claude Code matrix, plus the delay of the external-writer watcher and the after-Esc behaviour (expected: no auto-dispatch until the next completed turn).
  - Cleanup: kill waiters and servers, remove queued leftovers, archive the runs.
  - Docs: `docs/doorbell.md`.

- [x] Kind: verification | Status: done | Doorbell end to end in a running Claude Code implementation loop, and the Claude Code mechanism choice
  - Method:
    - Bind a sandbox epic on Claude Code and run the implementation loop.
    - Let a role raise a probe gate and end its turn waiting.
    - Submit answers through the probe server.
    - Confirm the loop resumes with no chat message.
    - Repeat once with the fallback path.
  - Tools: the probe kit, sandbox-test driver, `loop-watch.mjs`, progress logs.
  - Evidence:
    - Claude Code resumes without a human message.
    - The fallback resumes on any human message.
    - `docs/doorbell.md` holds the chosen Claude Code mechanism, the fallback rules, and the doctor checks needed (hook options such as the asyncRewake `timeout`).
    - D7 and R1 are updated for Claude Code.
  - Cleanup: archive the runs; remove probe hooks from the sandbox fixtures.
  - Docs: `docs/doorbell.md`, `decision-log.md` (D7, D8, D19).
  - Split (2026-10-20, stop review H3): the Codex half moved to the next task.

- [ ] Kind: verification | Status: on-hold | Doorbell end to end on Codex, and the Codex mechanism choice
  - Hold: human-action (H3)
  - Method:
    - Run the same end-to-end check on Codex, with the sandbox run `-s danger-full-access -a never`, because loop commits fail under `workspace-write` (run 11).
    - Include the deferred Codex matrix cell C: a queued message during a running loop, and how epic-loop classifies it.
  - Tools: the probe kit, sandbox-test Codex driver (`runs/2026-10-20-doorbell-codex-matrix/driver/`), progress logs, Codex rollouts.
  - Evidence:
    - Codex resumes without a human message.
    - The fallback resumes on any human message.
    - `docs/doorbell.md` holds the chosen Codex mechanism and the doctor checks needed (Codex version, `codex queue`).
    - D7 and R1 are updated for Codex.
  - Cleanup: archive the runs; remove queued leftovers.
  - Docs: `docs/doorbell.md`, `decision-log.md` (D7, D8, D19).
  - Needs: H3 (the human's approval of the `danger-full-access` run and Codex quota).

### Phase 3: Review Engine In The CLI

- Phase status: done
- Intent: the npm CLI serves review pages written by agents as HTML with the engine's web components; a static check derives the answer schema and the translation segments; the manager's page-builder and translator subagents produce pages (D4–D6, D13, D20, D21).

- Tasks: 6 closed tasks archived to `tracker.closed-phases.previous-layer-01.md`. Read it only if you need this phase's task-level closure context.

### Phase 4: Human Gates In The Loop

- Phase status: doing
- Intent: review pages, answers, the inbox and the doorbell become part of the loop. The manager opens blocking or non-blocking gates, the loop picks up answers and inbox requests at every role transition, an idle session is rung awake, and an accepted stop becomes a report page that can resume the loop on submit (D1, D7, D16, D22–D26).

- [x] Kind: implementation | Status: done | Gate lifecycle in the loop state
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

- [x] Kind: implementation | Status: done | Answers and inbox pickup at every role transition, with manager ingest
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

- [x] Kind: implementation | Status: done | Doorbell from the server, per platform, with fallback
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

- [ ] Kind: follow-up | Status: todo | Let the manager accept a stop without stdin, and keep an unresolved stop review from looping
  - Outcome: review-stop.mjs --outcome accepted also takes the report from a file (--file); a stop-review turn that ends without review-stop does not bounce between techlead and manager until next-role-not-set
  - Surface: scripts/lib/loop-stop-gate.mjs, review-stop.mjs, the stop-review prompt, hook-contracts and cli-contracts tests
  - Acceptance: a CLI contract test accepts a stop with --file; a hook contract test shows the routing after an unresolved stop review; found in sandbox run 12 (E1, E2) under a no-redirection command rule
  - Docs: .claude/skills/sandbox-test/runs/2026-10-20-doorbell-claude-e2e/log.md, docs/stop-gate.md
