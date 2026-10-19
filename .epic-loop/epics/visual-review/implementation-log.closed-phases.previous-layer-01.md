# Implementation Log: Closed Phases (previous layer 01)

Archived from `implementation-log.md` on 2026-10-20 during the Phase 5 closure housekeeping. Entries are unchanged and in their original order.

## Phase 1 - Manager Stop Gate And Human-Readable Stop Reports

### 2026-10-18T11:26:00+00:00 - started

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Route every techlead stop through a manager stop review
- Verdict: started
- Verification: Baseline from implementation-start housekeeping: test:unit 120/120, validate passes, runtime copy matches source
- Residual risk: Script roadmap state is stale (reports active phase 'Phase 1 - Shape The Epic'); tracker.md is the source of truth and was updated directly; roadmap render scripts are not used for this epic until realigned.

### 2026-10-18T11:33:13+00:00 - done

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

### 2026-10-18T11:39:11+00:00 - checkpoint (task still doing)

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

### 2026-10-18T11:45:05+00:00 - done

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

### 2026-10-18T11:48:10+00:00 - done

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

### 2026-10-18T11:53:12+00:00 - done

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

### 2026-10-18T11:54:15+00:00 - started (Claude Code half)

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Prove the stop gate end to end in sandbox runs on Claude Code and Codex
- Verdict: started (Claude Code half)
- Residual risk: Codex half queued as H1 (human-action): sandbox-test D-7 requires explicit per-run approval for -s danger-full-access -a never. Claude Code half proceeds as independent work. Previous task commit: 22b8446.

### 2026-10-18T12:16:32+00:00 - checkpoint: Claude Code run 5 done, task stays open

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Prove the stop gate end to end in sandbox runs on Claude Code and Codex
- Verdict: checkpoint: Claude Code run 5 done, task stays open
- Verification:
  - Techlead checked the archive: 2 stop-gate events (B accepted, A accepted), stop-reports 01 and 02 pass the checklist, German chat with English saved copies, H1-H3 queued, agent-made D1/D2
  - restore test 8/8
  - cost $6.15
- Residual risk: Findings: (1) C/D/E never filed, so the challenge path has no real-run evidence; (2) a human wait mid-loop was marked blocked, no H item, on-hold never used; (3) accepted stops leave stop reports uncommitted; (4) one request covered B/F/D under one class. 2 and 3 are fixed in a new Phase 1 task before the verification closes (D32 agent-made for 3); the rerun should also exercise the challenge path for B. Codex half still waits on H1.

### 2026-10-18T12:19:25+00:00 - done (prompt contracts); real-run evidence moves to the verification rerun

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

### 2026-10-18T12:34:53+00:00 - on-hold (H1): Claude Code half passed

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Prove the stop gate end to end in sandbox runs on Claude Code and Codex
- Verdict: on-hold (H1): Claude Code half passed
- Verification:
  - Techlead checked the run 6 archive: 3 stop-gate events (B challenged with the exact on-hold command, F accepted, A accepted), stop reports 01 and 02 committed by the manager (b175aa5, 5770c16), clean tree after both sessions, task on-hold with Hold: human-action (H1) instead of blocked
  - cost $5.78. Gap-fix commit f752633 verified.
- Residual risk: Codex half not run: waits on H1 (explicit approval for -s danger-full-access -a never). C/D/E challenge branches have unit-test evidence only. Follow-up added for loop-watch stop-gate events. Loop paused: nothing independent is left in Phase 1 (the PR task needs the verification).

### 2026-10-18T13:46:12+00:00 - checkpoint: Codex run 7 partial; task on-hold (H2 external-wait)

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Prove the stop gate end to end in sandbox runs on Claude Code and Codex
- Verdict: checkpoint: Codex run 7 partial; task on-hold (H2 external-wait)
- Verification:
  - Techlead checked the run 7 archive: 2 stop-gate events (B challenged with the exact on-hold command, D challenged with a port-0 workaround), 17 Stop-hook turn-starts, task on-hold with Hold: human-action (H1)
  - usage limit error in the session output
  - 11.3 M tokens
- Residual risk: Checks 2-4 on Codex not reached. Finding: the Codex techlead hand-wrote agent-made decisions instead of agent-decision.mjs; fixed next in a new Phase 1 task while the limit resets. H1 (approval) is resolved; H2 tracks the reset.

### 2026-10-18T13:47:46+00:00 - done (prompt contract); Codex behaviour is checked in the rerun

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

### 2026-10-18T13:49:24+00:00 - done

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

### 2026-10-18T14:56:07+00:00 - done

- Phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
- Task: Prove the stop gate end to end in sandbox runs on Claude Code and Codex
- Verdict: done
- Verification:
  - Claude Code: runs 5 and 6, all checks pass after f752633. Codex: run 7 (partial, usage limit) and run 8 (minimal, D33): Stop-hook chaining, B challenged with the on-hold command, task on-hold with Hold: human-action (H1), independent work completed, final B accepted with a six-heading report committed by the manager (fd99a2b in the sandbox)
  - 11 turns, 3.9 M tokens. Previous task commit: 0f283bb
- Residual risk: Not covered on Codex: F stop, rebind, class A, German chat (covered on Claude Code). Minor: the techlead's closure notes written after the last task commit stay uncommitted at a stop (D32 covers report, queue and decision log only). The agent-decision prompt fix (401f6ea) was not exercised on Codex (no class C default came up).

### 2026-10-18T14:59:42+00:00 - done; Phase 1 closed

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

## Phase 3 - Review Engine In The CLI

### 2026-10-19T18:31:29+00:00 - done

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

### 2026-10-19T18:37:29+00:00 - done

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

### 2026-10-19T18:45:21+00:00 - checkpoint (slice A of 2; task stays doing)

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

### 2026-10-19T18:53:15+00:00 - done (slice B completes the task)

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

### 2026-10-19T18:59:50+00:00 - done

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

### 2026-10-19T19:07:03+00:00 - checkpoint (slice A of 2: Claude Code; task stays doing)

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

### 2026-10-19T19:13:17+00:00 - done (slice B completes the task)

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

### 2026-10-19T19:30:26+00:00 - done (Phase 3 verified and closed)

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
