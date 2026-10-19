# Implementation Log

## 2026-10-17T18:03:53+00:00 - Epic Workspace Initialized

- Created epic workspace for `visual-review`.
- Initial mode: shaping.

## Phase 1 entries (archived)

- Archived to `implementation-log.closed-phases.previous-layer-01.md` (15 entries, 2026-10-18; Phase 1 merged into `main` as PR #13). Read it only if you need Phase 1 execution history.

## 2026-10-19T16:46:44+00:00 - done

- Phase: Phase 2 - Doorbell Spike
- Task: Doorbell probe kit for sandbox runs
- Verdict: done
- Changed:
  - New .claude/skills/sandbox-test/tools/doorbell/ (installer, answers server, submit, waiters for asyncRewake event/session and run_in_background, UserPromptSubmit fallback, hook logger, pickup, register-thread, latency summary, probe instructions, README)
  - run 9 log and drivers under runs/2026-10-19-doorbell-smoke/
  - LEARNINGS D-15
  - docs/doorbell.md smoke results
  - risk R8
- Verification:
  - Agent-free kit self-test
  - smoke run 9: Claude asyncRewake ring->hook 168 ms, pickup 3.8 s
  - Claude run_in_background 63 ms / 5.1 s
  - Codex codex queue on an idle TUI 10.1 s / 13.6 s on the default sandbox (96 k tokens). Techlead checked one pickup per archived probe log. test:unit 150/150, validate passes. Previous task commit: f9dc7f9 (merge base)
- Residual risk: Claude wakes arrive as UserPromptSubmit with <task-notification> XML and Codex queue as a plain prompt (R8); asyncRewake timeout cap and stderr limit unconfirmed; nested Claude sessions not fully isolated from the host env

## 2026-10-19T17:12:43+00:00 - done

- Phase: Phase 2 - Doorbell Spike
- Task: Claude Code terminal doorbell matrix
- Verdict: done
- Changed:
  - Run 10 log and drivers (run-cell.sh, make-steps.mjs, archive.sh) under runs/2026-10-19-doorbell-claude-matrix/
  - kit options --rewake-timeout, --rewake-pad, --pad, richer hook log
  - ptydrive run step
  - docs/doorbell.md Claude Code matrix
  - LEARNINGS D-16 and three needs-tuning entries
  - R8 updated
- Verification:
  - 22 cells, one sandbox each: all 4x6 cells have results (2C and 4C n/a with reasons). asyncRewake default timeout 600 s (hook SIGTERM at 600001 ms, 1E0)
  - 20 KB rewake body untruncated
  - mid-turn wakes delivered in the same turn after the tool call
  - Esc keeps waiters
  - close kills them, only SessionStart re-arms on resume. Loop cells 1C and 3C: epic-loop logs synthetic-prompt-ignored, loop chains to idle. Techlead spot-checked 1C/3C progress logs and 1E0. test:unit 150/150, validate passes. About $5.60 Sonnet. Previous task commit: 2a533a9
- Residual risk: 1C needed a rerun (dontAsk denies compound commands); E cells post-processed by hand after a mid-run driver edit; rewake bodies above 20 KB and run_in_background beyond 15 min idle untested

## 2026-10-19T17:48:45+00:00 - done (cell C deferred to the end-to-end task)

- Phase: Phase 2 - Doorbell Spike
- Task: Codex terminal doorbell matrix
- Verdict: done (cell C deferred to the end-to-end task)
- Changed:
  - Run 11 log and drivers (run-ccell.sh, make-steps.mjs, archive.sh) under runs/2026-10-20-doorbell-codex-matrix/
  - docs/doorbell.md Codex matrix
  - LEARNINGS D-17 and two needs-tuning entries
  - tracker note on the end-to-end task
- Verification:
  - codex queue: mid-turn held until the turn completes (39.5 s), after Esc not dispatched until the next completed turn, 15 min idle 13.4 s, closed thread queued and dispatched on resume (about 3 s), remote app server 14.0 s
  - fallback injects on Codex. Rollouts tag queued turns turn_trigger queue. Techlead checked one pickup per passing cell and the queue trigger in QD. 0.73 M Codex tokens of the 2 M budget. test:unit 150/150, validate passes. Previous task commit: d2ccfb2
- Residual risk: Cell C (queued message during a loop) needs a danger-full-access run; QD pickup latency unknown (model stall); hook payload visibility of turn_trigger unchecked; the setsid fix in run-ccell.sh is untested

## 2026-10-19T18:22:20+00:00 - done

- Phase: Phase 2 - Doorbell Spike
- Task: Doorbell end to end in a running Claude Code implementation loop, and the Claude Code mechanism choice
- Verdict: done
- Changed:
  - Run 12 log and drivers under runs/2026-10-20-doorbell-claude-e2e/
  - docs/doorbell.md Claude Code Choice proposal
  - R1 updated
  - agent-made decision D34 (asyncRewake waiter hook on Stop and SessionStart)
  - follow-up follow-up-02 (review-stop --file, unresolved stop review routing)
  - task 4 split and task 5 on hold with H3 (stop review)
  - LEARNINGS
- Verification:
  - E1: engineer background waiter, turn-waiting-background held the gate, wake 60 ms logged synthetic-prompt-ignored with turn_key_adopted, pickup 3.3 s, same engineer turn reported, loop chained on. E2: fallback alone does not hold a gate (loop moved on)
  - human ok logged user-message-in-turn with the pointer injected. E3: asyncRewake woke the idle loop in 0.2 s
  - the model rebound and the loop resumed with no human message. Techlead checked the progress and probe logs. test:unit 150/150, validate passes. About $5.27. Previous task commit: 86efcc8
- Residual risk: E1 and E2 stalled at class A because review-stop needs stdin under a no-redirection rule (follow-up-02); E3 auto-continue relied on the model rebinding; Codex half on hold (H3)

## Phase 3 entries (archived)

- Archived to `implementation-log.closed-phases.previous-layer-01.md` (8 entries, 2026-10-19; Phase 3 closed at `aac1655`). Read it only if you need Phase 3 execution history.

## 2026-10-19T19:39:38+00:00 - done

- Phase: Phase 4 - Human Gates In The Loop
- Task: Gate lifecycle in the loop state
- Verdict: done
- Changed:
  - scripts/gate.mjs and lib/loop-gates.mjs: open/ingested/close (manager turns only, review must have a schema, covers must be open H items, reopen keeps one entry) and list
  - gates in implementation_loop.gates
  - Stop of the manager turn that opened an unanswered blocking gate sets status awaiting-review with no continuation
  - answers-submitted logged once per submittedAt on any driver hook event
  - awaiting-review note on user messages, stop-loop and resume from it
  - role-summary open gates
  - CLI epic home Gates section from the runtime state
  - manager role Gates subsection, implementation-cycle step 14, manager prompt step 7, docs/human-gates.md
  - tracker compaction of closed phases 0, 1, 3 (manager housekeeping) and state-of-epic for Phase 4
- Verification:
  - gate-contracts.test.mjs 11 tests on codex and claude-code (non-blocking hands to techlead, blocking ends in awaiting-review, accepted stop wins, manager-only, validation, events with review id, answers-submitted once, stop-loop, resume)
  - review-server epic home gates test
  - techlead reran both files 20/20
  - test:unit 214/214, validate passes, browser-check passes
- Residual risk: answers are not routed to a manager ingest turn yet (Task 2); gate.mjs reaches the live runtime copy only after self-update

## 2026-10-19T19:48:54+00:00 - done

- Phase: Phase 4 - Human Gates In The Loop
- Task: Answers and inbox pickup at every role transition, with manager ingest
- Verdict: done
- Changed:
  - lib/loop-ingest.mjs: pending input (submitted gate answers not ingested, inbox entries after inbox_through), resume from awaiting-review, manager ingest turn before techlead/engineer (stop review first, techlead always after ingest), snapshot marked ingested on the ingest Stop with gate-ingested/inbox-ingested, one-time Human Input Ingested techlead note
  - ingest prompt template
  - inbox endpoint, form and recent entries in the CLI app (inbox.jsonl, I<n> ids)
  - human-queue resolve needs --confirmation for security-hold
  - role-summary pending input
  - manager Ingest and techlead Human Input Ingested references
  - implementation-cycle step 15
  - docs/human-gates.md
- Verification:
  - ingest-contracts.test.mjs 8 tests (both platforms for routing and resume), inbox server test, gate contract updated
  - techlead reran ingest, gate, review-server and human-queue tests 35/35
  - test:unit 223/223, validate passes, browser-check passes
- Residual risk: inbox ids restart if inbox.jsonl is deleted while inbox_through stays; the loop wakes only on a Stop until the doorbell (Task 3); new scripts reach the live runtime only after self-update

## 2026-10-19T20:06:09+00:00 - done

- Phase: Phase 4 - Human Gates In The Loop
- Task: Doorbell from the server, per platform, with fallback
- Verdict: done
- Changed:
  - Claude Code asyncRewake waiter (scripts/doorbell-waiter.mjs, lib/loop-doorbell.mjs) installed on Stop and SessionStart with timeout 86400 and rewakeMessage, per-epic lock, polls pending input, rings with the [epic-loop doorbell] pointer
  - Codex ring from the review server with codex queue --thread <driver session id> (D37), attempts in .runtime/doorbell.jsonl
  - doorbell-wake handling and the pending-input fallback note on UserPromptSubmit
  - submit response doorbell field and the page note
  - CLI doctor doorbell section (waiter timeout, Claude Code >= 2.1.293, codex >= 0.149 with codex queue)
  - references hooks-and-session-routing Doorbell, implementation-cycle step 16, manager Gates
  - docs doorbell.md Implemented, human-gates.md
- Verification:
  - doorbell-contracts.test.mjs 10 tests (waiter exit/ring/lock/stale lock, install idempotent, wake on both platforms to ingest, fallback notes, codex ring with a fake codex on PATH, missing codex, waiter mode, doctor)
  - browser-check asserts the none and loop-running notes
  - techlead reran doorbell, cli-package, gate and ingest tests 41/41 and found no leftover processes
  - test:unit 233/233, validate passes
- Residual risk: real hosts unproven: asyncRewake wake and rewakeMessage on a real idle session, a duplicate ring racing the resume, codex queue into an awaiting thread (H3); problem reports do not ring (Task 4)

## 2026-10-19T20:13:03+00:00 - done

- Phase: Phase 4 - Human Gates In The Loop
- Task: Stop report and human queue on a page, with auto-continue
- Verdict: done
- Changed:
  - gate.mjs open --stop-report (stop-review turn only, always blocking, refuses a page that misses an open H item, a d<n> control for an unconfirmed agent decision or the continue-after-submit check)
  - accepted stop with that gate goes awaiting-review with report_path and the review on the stop-gate event
  - continue-after-submit read at the ingest Stop (unanswered = on -> techlead with the auto-continue note, stop-report-continue
  - false -> idle, stop-report-paused)
  - problem reports as pending input with problems_through, waiter and Codex ring (reason problem), ingest prompt with fix steps, problems-ingested
  - stop-review prompt Stop Report Page section and short chat message
  - manager role, review-pages h<n>/d<n> naming, ingest prompt problem step
  - role-summary and epic home stop-report label
  - docs/human-gates.md
- Verification:
  - stop-report-contracts.test.mjs 5 tests (awaiting after accept, coverage refusals and stop-review-only, switch on resumes, switch off pauses, problem report rings/ingests once), Codex ring on a problem and the epic home label in doorbell and review-server tests
  - techlead reran stop-report, stop-gate, ingest and doorbell tests 42/42
  - test:unit 238/238, validate passes, browser-check passes
- Residual risk: the manager page-building step inside a stop review is only prompt-driven and unproven on a real host; Codex variants wait for H3

## 2026-10-19T20:51:31+00:00 - done (Codex half split into phase-4-task-6, on hold for H4)

- Phase: Phase 4 - Human Gates In The Loop
- Task: Human gates end to end on Claude Code
- Verdict: done (Codex half split into phase-4-task-6, on hold for H4)
- Changed:
  - sandbox run 16 (runs/2026-10-20-human-gates-claude: log, driver with human.mjs CDP/inbox/problem steps)
  - fix: the doorbell waiter waits up to 15 s for awaiting-review when the driver's manager turn opened a blocking gate (it raced the main Stop hook and exited), with two waiter tests
  - hooks reference and docs/doorbell.md note
  - LEARNINGS D-20 and three needs-tuning entries
  - tracker split of the verification (Claude Code / Codex) and H4 queued by the manager
- Verification:
  - Run 16, unattended interactive Claude Code, no human chat message: G (non-blocking gate + inbox ingested, problem report rang 1 s after the POST and led to a reworded page and reopened gate, blocking gate woke the idle session and resumed via ingest, security-hold H3 stayed open), SON (stop report page, switch on: resumed
  - reversed D1 became D2 and rework), SOFF (switch off: stop-report-paused, no further turns)
  - submit to wake 1-2 s
  - about $12.1
  - reruns: G after the waiter fix, SON after a dontAsk give-up (prompt rule)
  - techlead reran doorbell tests 12/12 and checked the five restore-tested bundles
  - test:unit 240/240, validate passes, browser-check passes
- Residual risk: Codex half on hold (H4); a duplicate ring after each wake is ignored as synthetic; the turn after a problem ingest delays the next answers' ingest by one techlead turn (D23)

## 2026-10-19T20:59:44+00:00 - done

- Phase: Phase 5 - Epic Viewer
- Task: Stable task ids and canonical references
- Verdict: done
- Changed:
  - lib/task-ids.mjs: T<n> · prefix in the task title (still matches the old TASK_LINE), Next task id header, ids never reused (max of header, tracker and archive layers), deterministic idempotent migration of tracker.md then archive layers on first roadmap use and in doctor's compatibility repair (assigned-task-ids, skill and CLI copy)
  - task scripts accept T12/t12/T-12
  - add-follow-up-task assigns the next id
  - roadmap-state carries tid
  - display 'Phase N Task k (T12) - title'
  - lib/id-index.mjs and scripts/id-index.mjs (definitions per home file, aliases, duplicates, unknown mentions)
  - artifact-model reference
- Verification:
  - task-ids.test.mjs 6 tests (fresh ids, no reuse after deletion and archiving, byte-stable migration, T/t/T- forms, doctor repair via CLI and skill, index of every kind)
  - tracker-in-place and roadmap tests adapted
  - old runtime copy read and patched a migrated copy of this epic (status only, prefix kept)
  - index on a copy of this epic: T 35, D 38, H 4, R 8, Q 10
  - techlead reran id tests 35/35
  - test:unit 246/246, validate passes
- Residual risk: this epic's tracker migrates at the first run after the next self-update; an older runtime reading a migrated tracker derives different follow-up slugs

## 2026-10-19T21:08:10+00:00 - done

- Phase: Phase 5 - Epic Viewer
- Task: Epic home as the live overview
- Verdict: done
- Changed:
  - CLI epic home: title and intent, loop state (mode, status, phase, task, role with ticking elapsed time, iteration), gates and pending reviews, human-queue items by hold kind (security-hold first, held tasks, review links), external waits, unconfirmed agent-made decisions, phases and tasks with progress and details, inbox, answered
  - packages/cli/src/epic/ parser copies and overview model
  - serve/home.mjs, serve/events.mjs (GET /api/<slug>/events SSE with debounced change events, heartbeat, per-client watcher, Origin guard), ?fragment=main, runtime home.js (swap keeping scroll, details and inbox draft
  - paused marker with backoff)
  - /_health watchers
  - home styles
  - review-engine.md routes
- Verification:
  - epic-home.test.mjs 3 tests (sections and fragment, change events for tracker, runtime state and agent-decision.mjs within 2 s, Origin guard, watcher cleanup)
  - browser-check home section (task change in about 410 ms, gate and decision updates within 3 s, no reload, details kept, elapsed ticks
  - light and dark screenshots checked)
  - techlead reran home and server tests 13/13 and browser-check
  - test:unit 249/249, validate passes
- Residual risk: phone width not checked in a browser (CSS breakpoint at 40rem); parser copies in the CLI must follow skill format changes

## 2026-10-19T21:20:12+00:00 - closed

- Phase: Phase 5 - Epic Viewer
- Task: Phase 5 Task 3 - Activity feed: what the agent is doing now, and turn statistics
- Verdict: closed
- Changed:
  - skill: implementation_loop.driver_transcript_path recorded from the driver's hook payloads (lib/loop-transcript.mjs, hooks.mjs, bind in epics.mjs/loop.mjs), documented in references/hooks-and-session-routing.md
  - CLI: per-platform transcript tail readers (src/epic/activity.mjs), a deliberate copy of the progress-report aggregation plus background and review waits (src/epic/statistics.mjs)
  - home: Activity section after Loop and a collapsible Turn statistics section
  - server: ?fragment=activity
  - SSE: watches the driver transcript (re-armed on a new path) and the progress log, sends event: activity
  - home.js refreshes only the activity section
  - docs/review-engine.md route contract
- Verification:
  - pnpm run test:unit 257/257 (new: activity.test.mjs, driver-transcript.test.mjs, epic-home activity/stats tests
  - statistics match progress-report.md built by rebuild-progress.mjs)
  - pnpm run validate passed
  - browser-check all passed (appended tool call shown in about 0.4 s without reload)
  - light and dark home screenshots reviewed, feed column wrap fixed
- Residual risk: Live check on both platforms is part of Phase 5 Task 6; this repo's live loop sees driver_transcript_path only after the next self-update. Fixtures are synthetic, modeled on the archived samples.
- Commit: this task commit (feat(app): activity feed and turn statistics)

## 2026-10-19T21:32:15+00:00 - closed

- Phase: Phase 5 - Epic Viewer
- Task: Phase 5 Task 4 - Docs browser and reference expansion
- Verdict: closed
- Changed:
  - CLI docs browser: /<slug>/docs/ index and /<slug>/docs/<path> pages (top-level artifacts, docs/**, stop-reports/**
  - .runtime, reviews, encoded .. and escaping symlinks are 404), markdown-it 14.1.0 with html off (D39), heading ids, relative links rewritten to doc pages (outside or missing paths shown as plain text), code spans naming epic files linked
  - GET /api/<slug>/ids from a copy of the skill's id index
  - server-side el-ref links on doc pages and the home with definition anchors
  - /_runtime/refs.js popover (hover, focus, Escape, aria-describedby) and client-side wrapping on review pages
  - Docs section on the home
  - doc pages refresh live on their own file
  - route contract in docs/review-engine.md
- Verification:
  - pnpm run test:unit 263/263 (new epic-docs.test.mjs)
  - pnpm run validate passed
  - build ok and dist serves a doc page with refs
  - browser-check all passed (link navigation to #D34, popover on hover and focus, Escape, review-page id expansion)
  - light and dark doc screenshots reviewed
  - acceptance on a migrated scratch copy of this epic: 14 pages, 353 internal links and 251 anchors with 0 failures, 251 of 251 expected id mentions expanded, 1 unknown id (T0)
- Residual risk: A doc page refreshes on changes to its own file only, not when the id index changes elsewhere.
- Commit: this task commit (feat(app): docs browser with expandable id references)

## 2026-10-19T21:43:51+00:00 - closed

- Phase: Phase 5 - Epic Viewer
- Task: Phase 5 Task 5 - Presentation-layer localization of epic content
- Verdict: closed
- Changed:
  - skill: set-second-language.mjs writes the 'Second language:' line of state-of-epic.md (D40), manager role and artifact model updated
  - CLI: EN | <code> switch on the home and doc pages via ?lang= links that set an el-lang cookie (SameSite=Strict) and redirect
  - background translator (one headless process at a time, deduplicated queue, scratch cwd, 120 s timeout killing the process group) on claude -p haiku or codex exec gpt-6-luna read-only per platform.json
  - docs translated as markdown sources with English heading ids, home translated as batched segments
  - validation of code, link targets, ids and heading count with rejection and no retry
  - cache under .runtime/translations/<lang>/ keyed by content hash with jobs.jsonl
  - event: translated swaps the fragment
  - route contract in docs/review-engine.md
- Verification:
  - pnpm run test:unit 270/270 (new epic-i18n.test.mjs with a fake translator, second-language.test.mjs)
  - pnpm run validate passed
  - build ok and the bundle translates a doc
  - browser-check all passed (RU switch, translated doc in about 0.4 s without reload, choice persists on the home, EN back)
  - light and dark screenshots of a translated doc reviewed
  - real smoke calls: Claude Code haiku 3.97 s and Codex gpt-6-luna read-only 5.1 s, both validated
- Residual risk: Header labels and the docs index page stay English; this repo's live epic gets its Second language line only after the next self-update.
- Commit: this task commit (feat(app): language switch with background translation)

## 2026-10-19T22:27:38+00:00 - closed

- Phase: Phase 5 - Epic Viewer
- Task: Phase 5 Task 6 - Viewer on a live loop and on a real epic, with design and accessibility review
- Verdict: closed
- Changed:
  - verification run 17 (sandbox-test runs/2026-10-20-viewer-verification): Claude Code live loop with a CDP watcher, a capped Codex workspace-write session, this epic on a migrated copy, an accessibility pass
  - fixes: event stream watches directories non-recursively (recursive fs.watch lost atomically replaced runtime-state.json, so the activity feed never armed after bind
  - regression test epic-events-live), transcript watched via its directory with a rearm interval
  - Codex <hook_prompt> shown as a turn item
  - feed paths relative to the project root and messages without bold markers
  - translation prompt v2 (imperative action labels, all headings)
  - Content-Language and reload on a language switch from another tab
  - inline code in intent and task details
  - header badge labeled pending reviews
  - LEARNINGS D-21, D-22
- Verification:
  - Claude attempt 5: feed median 427 ms (p90 2.4 s) over 29 samples, stats match progress-report.md, H1/D1, links, popovers, RU translation with real haiku and cache hit, themes via prefers-color-scheme, review page ids
  - Codex: driver_transcript_path from hook payloads, 58 feed items, stats matched 291/291 polls, 1.04 M tokens, no danger-full-access
  - this epic: 14 pages, 362 links and 259 anchors with 0 failures, 97 ids, translations validated
  - a11y: AA contrast 0 failures, visible focus on all stops, landmarks, names, keyboard paths
  - pnpm run test:unit 272/272, validate, build, browser-check all passed
- Residual risk: Method deviation: scripted CDP (D-19) instead of browser MCP; Claude spend about 5.67 USD over 5 attempts (diagnosis); minor findings tracked as the follow-up 'Viewer polish from the Phase 5 design and accessibility review'.
- Commit: this task commit (fix(app): event stream survives atomic writes; viewer verification run 17)

## 2026-10-19T22:31:29+00:00 - closed

- Phase: Phase 5 - Epic Viewer
- Task: Phase 5 Task 7 - Open the visual-layer pull request and stop for the human's merge
- Verdict: closed
- Changed:
  - Pushed feature/visual-review (new remote branch, 23 commits 2a533a9..98cd97c on top of origin/main f9dc7f9) and opened PR #16 https://github.com/usulpro/epic-loop/pull/16 'feat: visual layer for epic-loop: review pages, human gates and a live epic viewer' with per-phase summaries, verification run links, H3/H4, agent-made decisions D31, D32, D34-D40, after-merge steps, follow-ups and tests
  - state-of-epic.md records the PR
- Verification:
  - Before the push: test:unit 272/272, validate, build and browser-check passed
  - origin/main is an ancestor of HEAD
  - PR state OPEN, MERGEABLE, merge state CLEAN, CI check 'skill' passed
- Residual risk: The agent has not merged, pushed to main, force-pushed or published; this bookkeeping commit is pushed to the PR branch.
- Commit: this task commit (docs(epic): record the visual-layer PR #16)
