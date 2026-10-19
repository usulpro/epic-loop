# Implementation Log

## 2026-10-17T18:03:53+00:00 - Epic Workspace Initialized

- Created epic workspace for `visual-review`.
- Initial mode: shaping.

## 2026-10-18T11:26:00+00:00 - started

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Route every techlead stop through a manager stop review
- Verdict: started
- Verification: Baseline from implementation-start housekeeping: test:unit 120/120, validate passes, runtime copy matches source
- Residual risk: Script roadmap state is stale (reports active phase 'Phase 1 - Shape The Epic'); tracker.md is the source of truth and was updated directly; roadmap render scripts are not used for this epic until realigned.

## 2026-10-18T11:33:13+00:00 - done

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Route every techlead stop through a manager stop review
- Verdict: done
- Changed:
  - request-stop.mjs, review-stop.mjs, lib/loop-stop-gate.mjs
  - lib/loop.mjs (idle refusals, stop-review and challenge routing)
  - lib/loop-prompts.mjs
  - new stop-review prompt template
  - techlead prompt template
  - SKILL.md and implementation-cycle/techlead/manager references
  - tests/unit/stop-gate-contracts.test.mjs
  - one updated test in hook-interrupt-contracts
- Verification:
  - Techlead reran pnpm run test:unit: 130/130 pass (10 new stop-gate contracts, 5 per platform: codex and claude-code)
  - pnpm run validate passes
- Residual risk: Per-class rules are a placeholder in the stop-review prompt (task: Manager stop-review rules). A user stop during a stop review leaves stop_request in state until rebind clears it; harmless while idle. Live loop still runs the pre-change runtime copy by design (no self-update mid-run). Tasks reordered: the human-queue task now precedes the rules task, so the rules can name real queue and agent-decision commands.
- Commit: 930a751

## 2026-10-18T11:39:11+00:00 - checkpoint (task still doing)

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Agent-made decisions and the human queue as scripted epic artifacts
- Verdict: checkpoint (task still doing)
- Changed:
  - human-queue.mjs, agent-decision.mjs and their lib modules
  - role-summary blocks
  - init-epic creates human-queue.md
  - artifact-model and SKILL.md
- Verification:
  - Techlead reran pnpm run test:unit: 136/136 pass (6 new in human-queue-contracts)
  - pnpm run validate passes
- Residual risk: Engineer stopped on the on-hold part: every task/phase script fully re-renders tracker.md from a stale .runtime/roadmap-state.json and drops hand-written detail (reproduced in a temp root; confirmed in roadmap.mjs finalizeRoadmapMutation/ensureRoadmapState). Techlead took class C default D31 (agent-made): scripts re-import from tracker.md and patch it in place. Remaining scope: in-place tracker edits plus on-hold status.
- Commit: fdc38ec

## 2026-10-18T11:45:05+00:00 - done

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Agent-made decisions and the human queue as scripted epic artifacts
- Verdict: done
- Changed:
  - lib/tracker-file.mjs (scan + in-place patch)
  - lib/roadmap.mjs (fresh import, on-hold, follow-up lookup)
  - artifact-model and SKILL.md
  - tests/unit/tracker-in-place.test.mjs
- Verification:
  - Techlead reran pnpm run test:unit 141/141 and pnpm run validate
  - read the roadmap.mjs diff
  - closed this task and started the next one with the new source scripts on this epic: the tracker diff is exactly the two task lines, state-of-epic synced, the stale 'Phase 1 - Shape The Epic' bookkeeping is gone
- Residual risk: D31 is agent-made and unconfirmed. The live loop still runs the old runtime copy; do not use its roadmap scripts on this epic until self-update after merge (use the source scripts with --root . instead).
- Commit: fdc38ec, 08844f1

## 2026-10-18T11:48:10+00:00 - done

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Manager stop-review rules for classes A–F
- Verdict: done
- Changed:
  - lib/loop-prompts.mjs (STOP_CLASS_RULES, REPEATED_STOP_RULE, class rule block, challenge pointer)
  - stop-review and techlead prompt templates
  - manager role 'Rules By Class'
  - techlead role 'After A Challenge'
  - 2 tests in stop-gate-contracts
- Verification:
  - Techlead reran pnpm run test:unit 143/143 and validate
  - reviewed the rule data against D16/D23
  - prompt-level contracts cover all six classes and round 2
- Residual risk: Behavioural acceptance (a real manager applying the rules per class in fixture runs) is owned by the Phase 1 verification task, as the tracker states.

## 2026-10-18T11:53:12+00:00 - done

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Human-readable stop report from the manager
- Verdict: done
- Changed:
  - lib/stop-reports.mjs
  - review-stop accepted requires the English report on stdin and saves stop-reports/NN-date-class-X.md
  - the saved copy is the manager report
  - Stop Report section in the stop-review prompt
  - manager role, artifact-model, SKILL.md
- Verification:
  - Techlead reran pnpm run test:unit 147/147 and validate
  - reviewed the loop-stop-gate and loop-artifacts diffs (validation before any write
  - copy used only for the accepting manager turn). Previous task commit: f84098b
- Residual risk: Report quality and the checklist review of saved copies against docs/stop-gate.md belong to the Phase 1 verification task.

## 2026-10-18T11:54:15+00:00 - started (Claude Code half)

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Prove the stop gate end to end in sandbox runs on Claude Code and Codex
- Verdict: started (Claude Code half)
- Residual risk: Codex half queued as H1 (human-action): sandbox-test D-7 requires explicit per-run approval for -s danger-full-access -a never. Claude Code half proceeds as independent work. Previous task commit: 22b8446.

## 2026-10-18T12:16:32+00:00 - checkpoint: Claude Code run 5 done, task stays open

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Prove the stop gate end to end in sandbox runs on Claude Code and Codex
- Verdict: checkpoint: Claude Code run 5 done, task stays open
- Verification:
  - Techlead checked the archive: 2 stop-gate events (B accepted, A accepted), stop-reports 01 and 02 pass the checklist, German chat with English saved copies, H1-H3 queued, agent-made D1/D2
  - restore test 8/8
  - cost $6.15
- Residual risk: Findings: (1) C/D/E never filed, so the challenge path has no real-run evidence; (2) a human wait mid-loop was marked blocked, no H item, on-hold never used; (3) accepted stops leave stop reports uncommitted; (4) one request covered B/F/D under one class. 2 and 3 are fixed in a new Phase 1 task before the verification closes (D32 agent-made for 3); the rerun should also exercise the challenge path for B. Codex half still waits on H1.

## 2026-10-18T12:19:25+00:00 - done (prompt contracts); real-run evidence moves to the verification rerun

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Close the stop-gate gaps found in the Claude Code sandbox run
- Verdict: done (prompt contracts); real-run evidence moves to the verification rerun
- Changed:
  - techlead prompt and role: B/F always via request-stop even with independent work, never blocked, on-hold after challenge
  - B/F stop-review rules name the exact on-hold command
  - review-stop accepted prints the one D32 commit
  - stop-review prompt and manager role carry the commit rule
- Verification:
  - Techlead reran pnpm run test:unit 149/149 and validate
  - reviewed the loop-stop-gate diff (only existing files listed, shell-quoted)
- Residual risk: The acceptance's sandbox part (mid-loop B challenged, on-hold with H id, every stop report committed) is checked by the Claude Code rerun in the verification task.

## 2026-10-18T12:34:53+00:00 - on-hold (H1): Claude Code half passed

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Prove the stop gate end to end in sandbox runs on Claude Code and Codex
- Verdict: on-hold (H1): Claude Code half passed
- Verification:
  - Techlead checked the run 6 archive: 3 stop-gate events (B challenged with the exact on-hold command, F accepted, A accepted), stop reports 01 and 02 committed by the manager (b175aa5, 5770c16), clean tree after both sessions, task on-hold with Hold: human-action (H1) instead of blocked
  - cost $5.78. Gap-fix commit f752633 verified.
- Residual risk: Codex half not run: waits on H1 (explicit approval for -s danger-full-access -a never). C/D/E challenge branches have unit-test evidence only. Follow-up added for loop-watch stop-gate events. Loop paused: nothing independent is left in Phase 1 (the PR task needs the verification).

## 2026-10-18T13:46:12+00:00 - checkpoint: Codex run 7 partial; task on-hold (H2 external-wait)

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Prove the stop gate end to end in sandbox runs on Claude Code and Codex
- Verdict: checkpoint: Codex run 7 partial; task on-hold (H2 external-wait)
- Verification:
  - Techlead checked the run 7 archive: 2 stop-gate events (B challenged with the exact on-hold command, D challenged with a port-0 workaround), 17 Stop-hook turn-starts, task on-hold with Hold: human-action (H1)
  - usage limit error in the session output
  - 11.3 M tokens
- Residual risk: Checks 2-4 on Codex not reached. Finding: the Codex techlead hand-wrote agent-made decisions instead of agent-decision.mjs; fixed next in a new Phase 1 task while the limit resets. H1 (approval) is resolved; H2 tracks the reset.

## 2026-10-18T13:47:46+00:00 - done (prompt contract); Codex behaviour is checked in the rerun

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Make the techlead record its own defaults with the agent-decision script
- Verdict: done (prompt contract); Codex behaviour is checked in the rerun
- Changed:
  - techlead prompt and role reference: class C defaults taken by the techlead itself go through agent-decision.mjs add, never hand-written into decision-log.md
  - contract test
- Verification:
  - Techlead reran pnpm run test:unit 150/150 and validate
  - reviewed the 22-line diff. Previous checkpoint: 4719d68
- Residual risk: The Codex rerun (after the usage-limit reset, H2) must show its agent-made decisions through agent-decision.mjs list.

## 2026-10-18T13:49:24+00:00 - done

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Show stop-gate events in the sandbox-test loop-watch tool
- Verdict: done
- Changed:
  - .claude/skills/sandbox-test/tools/loop-watch.mjs prints stop-gate events (class, outcome, round, iteration, report, instruction)
  - LEARNINGS note resolved
- Verification:
  - Techlead reviewed the diff (existing line formats unchanged)
  - engineer showed HEAD vs new output on a temp progress log, including a line appended mid-run
  - validate passes. Previous task commit: 401f6ea
- Residual risk: Loop paused: nothing independent left in Phase 1; the Codex verification rerun waits on H2 (usage-limit reset), the PR on the verification.

## 2026-10-18T14:56:07+00:00 - done

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Prove the stop gate end to end in sandbox runs on Claude Code and Codex
- Verdict: done
- Verification:
  - Claude Code: runs 5 and 6, all checks pass after f752633. Codex: run 7 (partial, usage limit) and run 8 (minimal, D33): Stop-hook chaining, B challenged with the on-hold command, task on-hold with Hold: human-action (H1), independent work completed, final B accepted with a six-heading report committed by the manager (fd99a2b in the sandbox)
  - 11 turns, 3.9 M tokens. Previous task commit: 0f283bb
- Residual risk: Not covered on Codex: F stop, rebind, class A, German chat (covered on Claude Code). Minor: the techlead's closure notes written after the last task commit stay uncommitted at a stop (D32 covers report, queue and decision log only). The agent-decision prompt fix (401f6ea) was not exercised on Codex (no class C default came up).

## 2026-10-18T14:59:42+00:00 - done; Phase 1 closed

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Open the Phase 1 pull request and stop for the human's merge
- Verdict: done; Phase 1 closed
- Changed:
  - Pushed feature/manager-stop-gate
  - opened PR #13 https://github.com/usulpro/epic-loop/pull/13 (feature: manager stop gate, human queue and stop reports) against main
- Verification:
  - Techlead checked gh pr view 13: OPEN, not merged, head 93a6475 = local HEAD, 14 commits
  - origin/main unchanged at 80fe08f. Pre-push: test:unit 150/150, validate passes. Phase review: all 8 Phase 1 tasks done, the verification task passed on Claude Code (runs 5, 6) and Codex (runs 7, 8).
- Residual risk: Merge is the human's. Known limits are listed in the PR body and state-of-epic. Runtime copies still lack the stop gate until the post-merge self-update.

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

## 2026-10-19T18:31:29+00:00 - done

- Phase: Phase 3 - Review Engine In The CLI
- Task: Design language for the app and review pages
- Verdict: done
- Changed:
  - packages/cli/src/review/runtime/ tokens.css (colour, type, space, shape, motion
  - light, OS dark, forced dark), base.css (el-* shell, cards, choice/check, fields, buttons, submit bar, progress, save status, notices, badges, tables, segmented control, compare, lightbox
  - .is-* state hooks), specimen.html
  - build copies the runtime to dist/review/runtime (scripts/copy-runtime.mjs)
  - references/review-design.md
  - tests/unit/review-design-tokens.test.mjs
- Verification:
  - WCAG AA test over 30 pairs per theme passes (tightest: faint text 4.52, control border 3.50)
  - OS and forced dark blocks identical
  - specimen lists every colour token
  - build copy tested and a real build produced dist/review/runtime. Screenshots in both themes at 1280 and 390 px (sandbox-logs/2026-10-20-design-language). Design critique: no blocking issue
  - fixed mobile overflow, compare bar wrap, 28 px segmented targets, table hover, mono prose. test:unit 156/156, validate passes. Previous task commit: 4389302
- Residual risk: Separate accessibility-review skill not run; specimen ships in dist; packages/cli deps were installed in this worktree for the build check

## 2026-10-19T18:37:29+00:00 - done

- Phase: Phase 3 - Review Engine In The CLI
- Task: Review server with lifecycle and answers API in the npm CLI
- Verdict: done
- Changed:
  - packages/cli/src/serve/ (lifecycle, server, pages, answers, reviews, files): epic-loop serve with --detach/--status/--stop/--port/--root/--json, server.json, /_health, reuse and stale replacement
  - routes /, /<slug>, /<slug>/reviews/<id>/ (301 to the trailing slash), /_runtime/*
  - answers GET/PATCH per-control merge, submit (idempotent), problem (JSON and form) with atomic queued writes
  - injected runtime CSS, review meta and a no-JS problem form
  - Host, Origin, traversal and 1 MB guards. cli.mjs, paths.mjs (REVIEW_RUNTIME_DIR). docs/review-engine.md updated for the trailing slash, the answers shape and the guards
- Verification:
  - tests/unit/review-server.test.mjs 8/8 (techlead rerun), no orphan servers
  - full test:unit 164/164, validate passes
  - bundled dist/epic-loop.mjs serve checked with curl (pages, injection, runtime CSS 200) and stopped
  - screenshots in sandbox-logs/2026-10-20-review-server. Previous task commit: 82253dd
- Residual risk: No push of answers changed elsewhere to open pages (runtime task decides refresh vs SSE); concurrent first starts of two detached servers are not locked

## 2026-10-19T18:45:21+00:00 - checkpoint (slice A of 2; task stays doing)

- Phase: Phase 3 - Review Engine In The CLI
- Task: Page runtime and web components v1
- Verdict: checkpoint (slice A of 2; task stays doing)
- Changed:
  - runtime.js (ES module) with answer-store, progress and i18n modules
  - light-DOM components el-card, el-section, el-choice, el-check, el-select, el-comment, el-links, el-table
  - window.epicLoop API
  - debounced per-control saves with retry
  - submit bar with progress, cards menu, save status, theme and language switches
  - j/k and digit keys
  - server injects the runtime as a module
  - component and translation contracts in docs/review-engine.md and references/review-design.md
  - scripts/browser-check.mjs (CDP over Node WebSocket)
- Verification:
  - Techlead reran tests/unit/review-runtime + review-server (14/14) and browser-check.mjs (15/15 pass: save, reload restore, theme, ru switch and exact revert, submit, problem form, no page errors). test:unit 170/170, validate passes. Screenshots in sandbox-logs/2026-10-20-review-runtime. Checkpoint reason: the task is split into two slices
  - slice B (shot, lightbox, iframe, diagram, compare) follows. Previous task commit: 8ee9e7c
- Residual risk: Runtime UI strings stay English; short pages do not pin the submit bar to the viewport bottom

## 2026-10-19T18:53:15+00:00 - done (slice B completes the task)

- Phase: Phase 3 - Review Engine In The CLI
- Task: Page runtime and web components v1
- Verdict: done (slice B completes the task)
- Changed:
  - gallery.mjs, lightbox.mjs, visual.mjs: el-shot with a group lightbox whose side panel moves the card's live controls, el-iframe sandboxed (inline via <template>), el-diagram with bundled Mermaid 12.2.0 loaded on demand and re-rendered on theme change, el-compare with side/overlay/flip and width presets
  - /_runtime/vendor/ allow-list route
  - build copies vendor files
  - --color-embed-canvas token
  - specimen evidence section
  - docs (markup, Mermaid, files the check must verify)
  - agent-made decision for the npm package size
- Verification:
  - Techlead reran review-runtime + review-server (16/16) and browser-check.mjs (32/32: lightbox paging, panel controls moved and restored, digit saves, focus return, sandboxed frames report access blocked and origin null, Mermaid svg and theme re-render, compare modes, no request leaves 127.0.0.1). test:unit 172/172, validate passes
  - dist serves vendor/mermaid.min.js (5,494,801 bytes). Previous checkpoint commit: 92686ba
- Residual risk: npm package +5.5 MB (agent-made decision); full-page screenshots show the sticky bar mid-page (capture artifact)

## 2026-10-19T18:59:50+00:00 - done

- Phase: Phase 3 - Review Engine In The CLI
- Task: Static review check: schema, translation segments, safety
- Verdict: done
- Changed:
  - packages/cli/src/review/html.mjs (built-in tolerant HTML parser with line numbers, inert template, raw text, entities, implied closing)
  - review/check.mjs (controls, options, media, local files, network and unsafe markup, warnings, schema, segments via runtime i18n.mjs, translation gaps, atomic writes only on success)
  - cli.mjs review check command
  - docs/review-engine.md Check section with all codes and the schema shape
- Verification:
  - Techlead reran tests/unit/review-check.test.mjs (30/30: valid page, rerun stability, one fixture per error code, failing page keeps files, translation gaps and --lang, warnings, segment parity with the runtime fixture, parser cases). Engineer: test:unit 202/202, validate passes
  - both browser-check fixture pages pass from source and through dist. Previous task commit: 752657e
- Residual risk: Parser is not full HTML5 (no foreign content, adoption agency or foster parenting); unknown named entities stay literal

## 2026-10-19T19:07:03+00:00 - checkpoint (slice A of 2: Claude Code; task stays doing)

- Phase: Phase 3 - Review Engine In The CLI
- Task: Page-builder and translator subagents for the manager
- Verdict: checkpoint (slice A of 2: Claude Code; task stays doing)
- Changed:
  - references/review-pages.md (ladder, layout, skeleton, catalog, content rules, assets, check loop, custom blocks, gate summary)
  - assets/templates/review-page-builder-brief.md and review-translator-brief.md
  - manager role Review Pages section
  - check: rule is a rendered segment (test)
  - sandbox run 13 log and driver
  - LEARNINGS
- Verification:
  - Sandbox run 13: headless Sonnet manager made two Agent calls (builder default model, translator model haiku)
  - subagent metadata shows claude-sonnet-5-5 and claude-haiku-5-5
  - main thread saw only summaries
  - page passed review check --lang ru (0 missing, 0 stale) and rendered in Russian
  - about $0.43. Techlead checked the subagent metadata and reran review-check tests (30/30). test:unit 202/202, validate passes. Checkpoint reason: Codex slice follows. Previous task commit: ae37131
- Residual risk: Runtime UI strings stay English on translated pages; Codex delegation (Q10) not yet done

## 2026-10-19T19:13:17+00:00 - done (slice B completes the task)

- Phase: Phase 3 - Review Engine In The CLI
- Task: Page-builder and translator subagents for the manager
- Verdict: done (slice B completes the task)
- Changed:
  - Manager role Review Pages: Codex delegation via spawn_agent (fork_turns none
  - builder inherits the model, translator model gpt-6-luna with low effort) and wait_agent
  - the server cannot start inside Codex workspace-write (give the human the command)
  - both brief templates name the Codex call
  - Q10 resolved in decision-log
  - R5 updated
  - sandbox run 14 log and driver
  - LEARNINGS D-18
- Verification:
  - Sandbox run 14 (codex exec, workspace-write): spawn_agent calls with fork_turns none, translator model gpt-6-luna
  - child rollouts show gpt-5.6-sol/low and gpt-6-luna/low
  - main thread got 41-47 character tool results plus the two summaries
  - review check --lang ru ok (16 segments, 0 missing)
  - page renders in Russian. 761,056 tokens. Techlead checked the rollout model and the check output. test:unit 202/202, validate passes. Previous checkpoint commit: c955d3b
- Residual risk: On Codex the review server must be started outside the sandbox (Phase 4 doorbell server)

## 2026-10-19T19:30:26+00:00 - done (Phase 3 verified and closed)

- Phase: Phase 3 - Review Engine In The CLI
- Task: Three representative review pages, built by subagents, served and answered
- Verdict: done (Phase 3 verified and closed)
- Changed:
  - packages/cli/scripts/cdp.mjs: DevTools helpers shared by the browser scripts, browser-check.mjs uses it
  - review-pages.md: no repo paths as evidence, confirm/reverse pattern for agent-made decisions, created from date -u
  - sandbox run 15 log, driver (run.sh, verify.mjs, fixture) and LEARNINGS (D-19, three needs-tuning entries)
- Verification:
  - Run 15 on Claude Code (sonnet manager, 3 builders default model, 3 translators haiku, about $1.00 incl. a failed attempt from prefix-rule denials in subagents) and Codex (6 sequential spawn_agent calls, translators gpt-6-luna/low, 1.63 M tokens)
  - verify.mjs outside the sessions: all six pages check ok with 0 missing ru segments, served, every control answered, en and ru screenshots, lightbox and compare modes, submittedAt, problems.jsonl entry, values and submitted state restored after reload, no external requests, no page errors
  - main threads saw only summaries
  - techlead checked both summary.json files (0 failures)
  - test:unit 202/202, validate passes, browser-check all 32 pass
- Residual risk: Runtime UI strings stay English on translated pages; Codex workspace-write cannot start the server (Phase 4); Codex e2e doorbell still on hold (H3)

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
