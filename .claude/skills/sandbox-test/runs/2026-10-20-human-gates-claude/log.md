# Sandbox run: human gates end to end on Claude Code (2026-10-20)

Run 16 of the `sandbox-test` skill.

Questions this run answers:

- [FEATURE] Does the Phase 4 work hold up in a real interactive Claude Code session that runs the loop unattended?
  - gates (Task 1);
  - pickup and the manager ingest (Task 2);
  - the asyncRewake doorbell and the fallback (Task 3);
  - stop report pages with "continue after submit", and problem reports (Task 4).
- [FEATURE] The seven scenarios of the verification task "Human gates end to end on Claude Code". The human side is played only through the review pages, the inbox and the problem form, never through a chat message.
- [SANDBOX] Can the human side run as `ptydrive.py` `run` steps that drive the pages through CDP?

Layout:

- Sandboxes (disposable): `<workspace>/sandbox-hg-<cell>/`.
- Heavy artifacts: `<workspace>/sandbox-logs/2026-10-20-human-gates-claude/artifacts/<cell>/`. Each cell has:
  - the install and doctor output, the settings and the server record;
  - the prompt and steps, the raw pty log and the driver log;
  - the progress log, the human-side log (`human.jsonl`) and page screenshots;
  - a restore-tested git bundle, the `.epic-loop/` tree and the host transcript with its subagents.
- Fixtures: `<workspace>/sandbox-logs/2026-10-20-human-gates-claude/fixture-{G,S}`, built by `driver/make-fixtures.sh` from the run 12 "mini" base commit, with the human queue and the decision log written by the worktree's own scripts.
  - **G** has three human-queue items: H1 is a product decision (the greeting punctuation), H2 a human action (confirm the release name) and H3 a security hold (allow `npm publish`). Two fixture rules in the tracker tasks:
    - task 1: the manager opens a non-blocking page for H1;
    - task 2: the manager opens a blocking page for H2 and H3.
  - **S** has H1, a human action (the `NPM_TOKEN` secret in CI), and an unconfirmed agent-made decision D1 (the workflow runs on tags only). Its fixture rule makes the techlead file a class B stop.
- Driver (`driver/`):
  - `run.sh <G|SON|SOFF>`, with the body in `main()`;
  - `make-steps.mjs`;
  - `human.mjs`, which answers the latest gate's page from its schema through CDP, sends inbox entries and files problem reports;
  - `reap.mjs`, `archive.sh` and `make-fixtures.sh`.

Versions:

- Claude Code 2.1.293 (`sonnet`), interactive through `ptydrive.py`;
- `--permission-mode dontAsk` with `Read Edit Write Glob Grep Agent Bash`;
- `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0`;
- epic-loop installed from this worktree's source, with `EPIC_LOOP_CLI` pointing at the local CLI and the review server started by the driver.

## Journal

### 1. Plan and roll-out

- [SANDBOX] DECISION: three cells.
  - **G** covers scenarios 1, 2, 5, 6 and 7 in one chain.
  - **SON** and **SOFF** cover scenario 3 with the switch on and off; SON also covers scenario 4.
  - Planned cost: about $7 + $4 + $3. The cells ran in parallel, each as its own background task.
- [SANDBOX] PASS: doctor was `ready` with the doorbell `ready` in all cells. `.claude/settings.json` carried the waiter hooks on `Stop` and `SessionStart` (`asyncRewake`, `timeout: 86400`, `rewakeMessage`).
- [SANDBOX] PASS: `human.mjs` was dry-run against a fixture copy, with no model, before launch.

### 2. SOFF: a stop report page with the switch off (scenario 3b)

- [FEATURE] PASS.
  - The techlead filed class B. In the stop review, the manager had the page builder subagent build `2026-10-20-stop-report-1`.
  - `gate.mjs open --stop-report` passed the coverage check (H1, D1 and the switch). The stop was accepted, and the loop sat in `awaiting-review`.
  - The page was submitted with `h1` done, `d1` reverse and `continue-after-submit` false:
    - 20:19:38: submit; the page said "The loop picks your answers up now.";
    - 20:19:40: `doorbell-ring`, then `doorbell-wake`;
    - 20:19:42: `review-answered`, then `ingest-start`;
    - 20:19:54: `gate-ingested`, then **`stop-report-paused`**.
  - No turn started after that. H1 was resolved and D1 marked reversed. 4 loop turns.

### 3. SON: a stop report page with the switch on, and a reversed decision (scenarios 3a and 4)

- [SANDBOX] Attempt 1 (`artifacts/SON1`) stopped on a harness issue, not a product defect.
  - Ring, wake, ingest and **`stop-report-continue`** all passed.
  - In the techlead turn that followed, `dontAsk` denied one compound command (`sed … | head; cat … | head; git status`). The techlead concluded that "Bash is denied" and ended without `set-next-role`, which logged `next-role-not-set`.
  - DECISION: add a prompt rule ("a denied call only means that command; split it and retry; never end a role turn because of one denial") and rerun SON once, alone.
- [FEATURE] PASS (attempt 2):
  - 20:24:14: accepted class B with the page `2026-10-20-stop-1` (covers H1, the control `d1`, and the switch).
  - The chat message was short: why the loop stopped, D1 to confirm or reverse, the link, and "the loop resumes on its own unless you untick…".
  - 20:24:32: ring and wake; then ingest; 20:25:00: `stop-report-continue`; then techlead 5, with no human message.
  - Scenario 4: the ingest reversed D1. The techlead recorded the replacement default as **D2**, "runs when a GitHub release is published", with `agent-decision.mjs`, and briefed the engineer with the new trigger.
    - The engineer committed `fec7062`, "ci: add release workflow publishing to npm on GitHub release". The workflow uses `on: release: types: [published]`.
  - The phase closed with a class A stop. Because D2 is unconfirmed, the second stop also got a report page (`2026-10-20-stop-2`), again with a short chat message and the link. 12 loop turns.
- [FEATURE] OBSERVATION: a second `doorbell-ring` came 2 s after the wake (20:24:34). The waiter armed by the wake turn's own `Stop` saw the answers before the main hook resumed the loop. The running loop logged it as `synthetic-prompt-ignored`. It is harmless, as the Task 3 report predicted.

### 4. G: gates, the inbox, a problem report and a security hold (scenarios 1, 2, 5, 6 and 7)

- [FEATURE] **BUG** found in attempt 1 (`artifacts/G1`): the waiter never armed for a blocking gate opened in a manager housekeeping turn.
  - Scenarios 1 and 6 passed. Then the loop reached `awaiting-review` (20:21:27), and the problem report posted at 20:21:42 rang nothing for over two minutes. No waiter process existed.
  - Cause: the waiter starts on the same `Stop` event in which the main hook sets `awaiting-review`. It read the state first, saw `running` and exited, and nothing re-armed it.
  - SON and SOFF were not affected, because there the stop review sets `awaiting-review` before the `Stop`.
  - FIX (`scripts/lib/loop-doorbell.mjs`):
    - When the session's loop is about to wait, the waiter now waits up to 15 s (`EPIC_LOOP_DOORBELL_GRACE_MS`) for `awaiting-review`. "About to wait" means a manager turn of the driver that has a blocking gate opened in this iteration.
    - With no such gate it still leaves at once.
    - Tests in `tests/unit/doorbell-contracts.test.mjs`:
      - "a waiter started by the Stop of the manager turn that opened a blocking gate waits…";
      - "a waiter with no blocking gate about to wait leaves at once".
  - G was then rerun once, alone.
- [FEATURE] PASS (attempt 2):
  - **Scenarios 1 and 6, the non-blocking gate and the inbox.**
    - 20:27:42: the manager opened the non-blocking `2026-10-20-h1-punctuation` (covers H1).
    - The human chose `.` while the loop worked. The page said "picks your answers up at its next step". Then the human sent I1, "Please also export farewell(name)…".
    - 20:28:02: `ingest-start` with that review and `I1`; 20:28:22: `gate-ingested` and `inbox-ingested`.
    - The techlead note carried I1 verbatim. The result: `greet()` ends with `.` (`a85c7d0`), and `farewell(name)` was added (`9e54955`).
  - **Scenario 7, the problem report.**
    - 20:30:29: `awaiting-review` on the blocking `2026-10-20-release-gate` (covers H2 and H3). The fix armed the waiter.
    - 20:30:45: problem report; 20:30:46: `doorbell-ring` with `problem_reviews`, then `doorbell-wake`, then the ingest.
    - The manager had the page builder reword the H2 card to name "Mini 1.0" and re-ran `review check`. It reopened the gate blocking, logged `problems-ingested`, and the loop was back in `awaiting-review`. Its report gave the link again.
  - **Scenarios 2 and 5, the blocking gate and the security hold.**
    - 20:31:32: submit with `h2` checked and `h3` left unconfirmed. The ring and the wake came the same second, then `review-answered`.
    - The loop ran techlead 13 first (the turn after an ingest is always the techlead's, D23), then the ingest at 20:32:10, then `gate-ingested`. No human message was needed.
    - H2 was resolved. **H3, the security hold, stays open.** `RELEASE.md` was committed (`00d561c`).
  - The epic closed with a class A stop (20:34:24). H3 is open, so that stop got a report page too. About 25 loop turns.
- [SANDBOX] Driver bug: G waited for a third `gate-ingested`, but a problem ingest logs `problems-ingested`, so that step timed out after 15 minutes of idle time. `make-steps.mjs` now waits for two.

### 5. Results

| # | Scenario | Cell | Result | Key events | Human chat message | Screenshot |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Non-blocking gate answered while the loop works | G | PASS | `gate-opened` (blocking false), `ingest-start`, `gate-ingested` | none | `G/page-2026-10-20-h1-punctuation-*.png` |
| 2 | Blocking gate rings the idle session, the loop resumes | G | PASS (after the waiter fix) | `awaiting-review`, `doorbell-ring`, `doorbell-wake`, `review-answered`, `ingest-start`, `gate-ingested` | none | `G/page-2026-10-20-release-gate-*.png` |
| 3a | Stop report page, switch on | SON | PASS (attempt 2) | `stop-gate` (with review), ring, wake, ingest, `stop-report-continue` | none | `SON/page-2026-10-20-stop-1-*.png` |
| 3b | Stop report page, switch off | SOFF | PASS | `stop-gate`, ring, wake, ingest, `stop-report-paused`, no turn after | none | `SOFF/page-2026-10-20-stop-report-1-*.png` |
| 4 | Reversed agent decision becomes rework | SON | PASS | D1 reversed, replacement D2 recorded, workflow built on the new trigger | none | as 3a |
| 5 | A security hold is not resolved by a plain submit | G | PASS | H3 open after the ingest; H2 resolved | none | as 2 |
| 6 | Inbox request mid-loop, picked up at the next transition | G | PASS | `ingest-start` with I1, `inbox-ingested`, I1 verbatim in the techlead note | none | n/a |
| 7 | Problem report leads to a fixed page | G | PASS | `doorbell-ring` with problem reviews, page reworded and re-checked, gate reopened, `problems-ingested` | none | as 2 |

- [SANDBOX] Latency from submit to wake: 1–2 s in every cell. Time and cost, estimated from the transcripts (main thread and subagents) at Sonnet list rates:

  | Cell | Wall time | Estimated cost | API calls |
  | --- | --- | --- | --- |
  | G | 21 min, of which 15 min was the idle driver timeout | about $5.26 | 103 |
  | SON | 6.5 min | about $2.34 | 58 |
  | SOFF | 3.5 min | about $1.01 | 23 |
  | G1 (attempt 1) | | about $2.22 | |
  | SON1 (attempt 1) | | about $1.25 | |
  | **Total** | | **about $12.1** (budget $15) | |

- [FEATURE] OBSERVATION: one screenshot shows the progress bar partly filled at "3 / 3". A probe showed the correct fill width after the 140 ms transition, so the capture caught the transition. It is not a defect.

### 6. Archive and cleanup

- [SANDBOX] All five sandboxes (G, G1, SON, SON1, SOFF) were bundled and restore-tested. Each also got its `.epic-loop/` tree, settings and host transcript (with `subagents/`). Then the sandboxes and their `~/.claude/projects` directories were removed.
- [SANDBOX] No waiter, server, Chrome or pty process is left. The servers were stopped by `run.sh`.
- [SANDBOX] FINDING (driver): `reap.mjs` matched by sandbox path and killed my own monitor's `tail`. It now kills only waiters and servers.
- [SANDBOX] Leftover: three trust entries for the sandbox paths in `~/.claude.json` (from the interactive trust dialog), as in earlier interactive runs.

## Summary

- [FEATURE] **The human gates work end to end on Claude Code.** All seven scenarios passed in an unattended interactive session, with the human acting only through the pages, the inbox and the problem form. The asyncRewake doorbell woke the idle session within 1–2 s every time.
- [FEATURE] One product bug was found and fixed with tests: the waiter missed a blocking gate opened in a housekeeping turn because it raced the main `Stop` hook.
- [SANDBOX] The human side as `ptydrive` `run` steps (`human.mjs` through CDP) worked without a second coordinating process.
  - Gating on the product's own progress events kept every step deterministic.
  - The one-denial give-up in `dontAsk` needed a prompt rule.
