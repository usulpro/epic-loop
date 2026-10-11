# Sandbox run: PR #8 review findings, round 2 (2026-10-11)

Run 4 of the `sandbox-test` skill.

A second `/code-review` of PR #8 (`fix/bg-task-notification-interrupt`, HEAD `cdd1a29`) returned 10 findings, mostly against the background-wait fix `646742b`. Per D-10, each finding is triaged and the remaining ones are reproduced before any becomes a PR comment.

Questions this run answers:

- [FEATURE] #3 (`loop-background.mjs:25`): when a role starts two background tasks and ends its turn, does the first notification end the single allowed wait, so the role's second "still waiting" message is recorded as its report?
- [FEATURE] #1 (`loop-user-prompt.mjs:85`): when the user writes while a role is waiting for its own background task, is that taken as an Esc abort? Does the resumed role then put the still-running task in its baseline and get its "waiting" message recorded as the report?
- [FEATURE] #2 (`loop.mjs:173`): when a role leaves a long-lived background process running (a dev server) and ends with its full report, does the loop discard the report and stall?
- [FEATURE] #6 (observation only): does any notification after a wait arrive under the same `prompt_id` (`turn_key_adopted: false`)?
- [SANDBOX] One sandbox and one session per scenario, generated from a shared launcher (`run-scenario.sh`) and step generator (`make-steps.mjs`), so that the exact launch command is recorded.

Layout:

- Sandboxes (disposable): `/projects/my-projects/epic-loop-workspace/sandbox-review-pr8-r2-{A,B,C}/`
- Heavy artifacts (local only, not in git): `/projects/my-projects/epic-loop-workspace/sandbox-logs/2026-10-11-review-pr8-round2/` (`fixture/`, `artifacts/<scenario>/`)
- Driver scripts and prompts (committed): [`driver/`](driver/). `watch.mjs` / `transcript.mjs` from the run became `tools/loop-watch.mjs` / `tools/transcript-timeline.mjs`

## Journal

### 0. Triage without an agent

- [FEATURE] DISMISSED, #4 (missing `turn_key` makes a mid-turn message an abort). Not reachable on current hosts: all 52 archived Claude Code hook payloads from run 3 (Stop and UserPromptSubmit, three sessions) carry `prompt_id`, and Codex payloads carry `turn_id` (run 2). The null-key rule is a documented design decision.
- [FEATURE] DISMISSED, #5 (a wake after Esc adopts the new `turn_key`, so its reply is recorded as the report). This is run 3's bug A: mechanism confirmed, no harm (the reply was the full report), and the user decided not to fix it. `646742b` only changes which key is stored.
- [FEATURE] DISMISSED, #7 (`roleChosenDuringTurn` compares second-precision `nowIso()` with a strict `>`). Not reachable in practice: the turn start is stamped at the previous role's `Stop`, so a `set-next-role` in the same second would need the model to read the techlead prompt and issue a tool call in under 1 s. The strict `>` is a documented trade-off.
- [FEATURE] NOT REPRODUCED ON PURPOSE, #8 (roadmap merge and progress-report rebuild on every synthetic prompt), #9 (three writers of interrupted state), #10 (altitude: completion inferred from `Stop`). These are cleanup and design items, reported to the user.

### 1. Roll-out

- [SANDBOX] OBSERVATION: run 3's log names the fixture's initial commit `d42e7a1`, but in run 3's bundle it is `cb0c608` (`d42e7a1` is probably run 2's).
- [SANDBOX] DECISION: a new fixture (`fixture/`, commit `4c87cda`). It is the run 3 fixture with two changes: `slow-check.mjs` takes `--name` / `--seconds` and writes `slow-check <name> started|finished` markers, and `dev-server.mjs` is a plain `http` server on a random port that writes `started` / `stopped` markers and never exits. `techlead-gate.mjs` is dropped. The epic is shrunk to one task (mean), because every finding shows up in the first engineer turn.
- [SANDBOX] DECISION: the launch command was not recorded in runs 2–3. This run keeps it in `driver/run-scenario.sh`. Flags per D-6: `--setting-sources project`, `--permission-mode dontAsk`, an allowlist (Read, Edit, Write, Glob, Grep, Monitor, `Bash(node|npx|git|npm|ls|cat|head|wc:*)`), `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1`, and cap 0. The script also runs the local-CLI install from the branch, `diff -rq` against `plugins/`, doctor through the wrapper, and `state-history.mjs`.

### 2. Checks without an agent

- [FEATURE] PASS (A): the local-CLI install put skill 0.2.1 and the hooks in place, and the skill copy matches `plugins/` (`diff -rq` clean). Doctor through the wrapper with cap 0 reports `ready`. `artifacts/A/01-install.txt`, `02-doctor.json`.

### 3. Interactive agent sessions

Claude Code 2.1.293, the user's default model, one session per scenario, launched by `driver/run-scenario.sh <X>`. `driver/watch.mjs <X>` streams loop events and markers into a Monitor, and `driver/transcript.mjs <X> [from] [to]` prints a compact timeline of the host transcript.

#### Scenario A: two background tasks (#3)

- [FEATURE] CONFIRMED, with harm. Timeline (`progress-log.jsonl`, markers, transcript):
  - `13:36:02` engineer iter 3 starts `a` (10 s, `bhw0atjmt`) and `b` (60 s, `btwq0719y`) in the background, runs `npm test` (4/4), and ends its turn with "waiting for their completion notifications".
  - `13:36:05` `turn-waiting-background` with both ids.
  - `13:36:12` `a`'s notification wakes the turn (`turn_key_adopted: true`, the "Continue the engineer turn" context arrives). The engineer reads `a`'s output.
  - `13:36:15` the engineer ends again: "Check a printed `slow-check a: OK`. Check b (60s) is still running; waiting for its notification before reporting." The wait was already used, so `turn-stop` records that line as `latest-engineer-report.md` (`artifacts/A/08-engineer-report-iter3.md`) and techlead iter 4 starts. `b` finishes at `13:37:02`, 47 s later.
  - Techlead iter 4 sees the report is only a "waiting" note, logs "not closed", and sends the engineer back for a full verification pass (iter 5).
  - Iter 5 is the baseline variant of the same finding. `13:36:53` it starts new `a` (`b25j6xbmj`) and `b` (`bestit0le`). `turn-waiting-background` lists only those two, because iter 3's `b` is in the baseline. `13:37:02` iter 3's `b` finishes, and its notification (a baseline task) wakes the turn and uses up the wait. `13:37:08` the engineer ends with "Waiting: … this run's check b (60s) is still running", which is recorded as the report (`08-engineer-report-iter5.md`). Techlead iter 6 starts while `b` runs until `13:37:54`.
  - `13:37:50` techlead iter 6 runs `set-next-role idle` with the reason "verification blocker: loop closes engineer turn after…". Its final message diagnoses the loop correctly ("the loop wakes a waiting engineer turn only once per background check") and asks the user to choose. Task 1 is not closed and nothing is committed.
- [FEATURE] Harm: the epic stops and needs the user, after one wasted engineer and techlead cycle. The protocol is legitimate (two checks of different length), and the model followed it exactly.
- [FEATURE] OBSERVATION (#6): at `13:37:06`, iter 5's own `a` notification arrived while the woken engineer was still working, under the same `prompt_id` (`turn_key_adopted: false`, delivered as a `queued_command` attachment). That is mid-turn delivery, where no new context is needed. It is not the race #6 describes.
- [SANDBOX] LESSON: `run-scenario.sh`'s `trap … EXIT` did not kill `state-history.mjs`, so it is now killed explicitly after the driver. `archive.sh` needed `git bundle create -q <file> --all` (flag before the file) and no `-q` on `verify`.
- [SANDBOX] Archived in `artifacts/A/90-archive/` (bundle restore-tested: 1/1, because the fixture commit is the only one and the `mean` work is in `uncommitted.diff`). Sandbox and host transcript dir removed.

#### Scenario B: user message during a background wait (#1)

- [SANDBOX] WORKAROUND, attempt 1 (`artifacts/B-attempt1/`): the driver's `forbid` (`update available|auto-update`) matched the agent's own words "no update available" from its doctor summary and killed the session after shaping. The pattern is now `(?<!no )update available|auto-update`. The sandbox was reset and the scenario rerun.
- [SANDBOX] LESSON: `node` here is a Volta shim, so `$!` was the shim's pid and `kill` left the real `state-history.mjs` running (A and B attempt 1). The launcher now starts it through `$(node -p process.execPath)`. Also, `pkill -f <pattern>` from the agent's shell matches the shell's own command line and kills it; list pids with `pgrep` and filter instead.
- [FEATURE] CONFIRMED, with harm (extra cycles; the loop recovered). Timeline (attempt 2):
  - `13:43:19` engineer iter 3 starts `slow-check main` (90 s, `bnvxjo46s`), runs `npm test` (3/3), and ends with "waiting for its completion notice". `13:43:21` `turn-waiting-background`.
  - `13:43:27` the driver types "how is it going? one sentence." The hook logs `turn-aborted` (`reason: user-aborted-turn`, `next_role: engineer`), and the agent is told "the user interrupted the engineer turn", which is false: no Esc was sent. State snapshot 0008: `active_turn_stopped_at` set, `resume_after_user_turn: true`.
  - `13:43:29` the agent answers in one sentence. That `Stop` starts engineer iter 4 with the "Resuming the engineer turn that the user interrupted" note. Snapshot 0009: `background_task_baseline: ["bnvxjo46s"]`, the engineer's own still-running check.
  - `13:43:33` iter 4 checks the state, sees the check still running, and ends with "I'll end the turn and wait for its notification, then write the report." The task is in the baseline, so there is no wait, and that line becomes the engineer report (`artifacts/B/08-engineer-report-iter4.md`). Techlead iter 5 starts.
  - Techlead iter 5 sends the engineer back (iter 6). Iter 6 repeats scenario A's baseline variant: its own check `bl9dsf0y9` is waited for, but iter 3's `bnvxjo46s` finishes at `13:44:49` and wakes the turn, and the engineer ends again with "ending the turn again to wait" (report `08-engineer-report-iter6.md`). Its own check's notification then lands in techlead iter 7 (`13:45:35`, `synthetic-prompt-ignored`, role `techlead`).
  - Techlead iter 7 sends the engineer back again. Iter 8, with no stale tasks left, waits once, is woken by its own check (`turn_key_adopted: true`), and writes the full report (`08-engineer-report-iter8.md`). This is the control: the `646742b` fix works when nothing interferes.
  - The loop closed the task (`f67a452`) and reached `idle` at `13:48:10`.
- [FEATURE] Harm: one user question cost 2 extra engineer and 2 extra techlead turns (about 4.5 min from the question to the accepted report), plus a false "interrupted" message to the agent. The outcome was correct here only because the techlead rejected the "waiting" reports. A techlead that trusts the report would close the task unverified.
- [SANDBOX] Archived in `artifacts/B/90-archive/` (bundle restore-tested: 3/3). Sandbox and host transcript dir removed.

#### Scenario C: a long-lived dev server (#2)

- [FEATURE] CONFIRMED, with harm (stall). Timeline:
  - `13:51:00` engineer iter 3 starts `dev-server.mjs` in the background (`bqe1984ex`, pid 628903), reads its `listening on` line, and runs `npm test` (3/3).
  - `13:51:08` the engineer ends with its complete report (changed files, tests, server URL). The `Stop` logs `turn-waiting-background` with `bqe1984ex` and records no report: no `latest-engineer-report.md` exists, and no next role starts.
  - `13:51:08`–`13:54:10`: no loop event for 3 min, while the session sits idle at the prompt. The server never exits, so no notification ever arrives. Without user input the stall has no end.
  - `13:54:10` the driver types "status? one sentence." That is logged as `turn-aborted` with the false "the user interrupted the engineer turn" context, as in B.
  - `13:54:13` engineer iter 4 resumes with the resume note. It re-checks (`git status`, `npm test`, the server output), says "the work from before the interruption is all still in place, so I didn't redo any of it", and repeats the report. The server is now in the baseline, so there is no wait. `13:54:29` the report is recorded, and techlead iter 5 accepts it.
  - The loop committed `6c5017e` and reached `idle` at `13:55:58`. The server stopped with the session (`dev-server stopped 13:58:10`).
- [FEATURE] Harm: the loop stalls indefinitely after a complete role report until the user writes. In this run the resume did not redo the code, because the resume note works. The finding's "redoing work" part is therefore only a re-verification here.

#### #6: notifications under the same `prompt_id`

- [FEATURE] NOT REPRODUCED. All 5 wakes of a waiting session (A ×2, B ×3 counting iter 8) came with a new `prompt_id` (`turn_key_adopted: true`) and got the "Continue the <role> turn" context. The two `turn_key_adopted: false` events (A `13:37:06`, B `13:45:35`) were notifications delivered while a turn was running, where no context is needed. The race #6 describes (task finishes between the `Stop` hook returning and the turn ending) was not observed. It stays a theoretical gap.

### 4. Fixes

- [FEATURE] None in this run. The verdicts go to the user first (D-10); fixes and PR comments wait for the user's decision.

### 5. Archive and cleanup

- [SANDBOX] Each scenario was archived by `driver/archive.sh <X>` into `artifacts/<X>/90-archive/`: git bundle (verified and restore-tested by cloning and running `npm test`), `.epic-loop/` including `.runtime`, `.claude/settings.json`, `.sandbox/markers.log`, `uncommitted.diff`, `git-log.txt`, and the host transcript dir. Then the sandbox and `~/.claude/projects/<sandbox>` were removed.
- [SANDBOX] Inventory: no sandbox dirs, no `slow-check`, `dev-server`, or `state-history` processes. `~/.claude.json` keeps 3 trust entries for the sandbox paths (left alone, as in runs 2–3). The npx cache is kept.

## Summary

### [FEATURE]

| Finding | Verdict | Evidence |
| --- | --- | --- |
| #1 user message during a background wait becomes an abort | **Confirmed, harm** | B: false "interrupted" context; the resumed engineer had its own running task in the baseline, and "I'll end the turn and wait" was recorded as the report. 2 extra engineer and 2 extra techlead turns |
| #2 a long-lived background process stalls the loop | **Confirmed, harm** | C: complete report discarded; no loop event for 3 min until the user wrote |
| #3 one wait per turn; any notification ends it | **Confirmed, harm** | A: "waiting for b" recorded twice (two tasks, then a baseline task's notification); the techlead stopped the loop as blocked, with the task unclosed and nothing committed |
| #4 missing `turn_key` | Dismissed | Every payload carries `prompt_id` / `turn_id` |
| #5 wake after Esc adopts the key | Dismissed | Run 3 bug A, no harm |
| #6 notification under the same `prompt_id` after a wait | Not reproduced | 5/5 wakes had a new `prompt_id` |
| #7 second-precision `>` | Dismissed | Not reachable in practice |
| #8–#10 | Not bugs | Cleanup and design, for the user |

- The `646742b` fix works in the clean case (B iter 8, run 3's bgwait). It breaks in exactly three ways, all of which reproduce with realistic protocols: more than one background task, user input during the wait, and a task that never ends.
- The three failures share #10's root cause: the loop infers "role finished" from a `Stop` plus payload heuristics. In A and B the techlead caught the bad reports. A techlead that trusts the report would close tasks unverified.

### [SANDBOX]

- **Worked:**
  - One sandbox per scenario from a shared fixture, with the launcher, step generator, and archiver scripted (`driver/`). The exact launch command is now on record, which runs 2–3 lacked.
  - Marker files plus `progress-log.jsonl` in a Monitor (`loop-watch.mjs`), and a transcript timeline (`transcript-timeline.mjs`). Both are now in `tools/`.
  - `state-history.mjs` again gave the decisive evidence (B's baseline in snapshot 0009).
  - Copying `latest-*-report.md` at each turn boundary, because the file is overwritten.
- **Didn't work:** the `forbid` regex matched the agent's own words (attempt 1 of B lost). Volta's `node` shim broke `kill $!`. `pkill -f` killed the agent's shell. `git bundle` flag order.
- **Changes in `LEARNINGS.md`:** run row, confirmations, D-11 (scripted launcher), and new "Needs tuning" items for `forbid` and process cleanup.
