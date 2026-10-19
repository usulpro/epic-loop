# Sandbox run: Claude Code terminal doorbell matrix (2026-10-19)

Run 10 of the `sandbox-test` skill.

Questions this run answers:

- [FEATURE] Which wake mechanism wakes an interactive Claude Code 2.1.293 session in each state, and how do epic-loop's hooks see the wake?
  - Mechanisms: `asyncRewake` on `Stop`, `asyncRewake` on `SessionStart`, a `run_in_background` waiter, the `UserPromptSubmit` fallback.
  - States: A idle, B mid-turn, C an epic-loop loop running, D after Esc, E 15 min idle, F closed and resumed.
- [FEATURE] What are the effective asyncRewake timeout and the rewake stderr size limit?
- [SANDBOX] Can one generic cell driver plus a pty `run` step cover a whole matrix, with one sandbox per cell, in parallel?

Layout:

- Sandboxes (disposable): `<workspace>/sandbox-dbm-<cell>/`. A cell is the row (1–4) followed by the state (A–F, or S for the stderr probe).
- Heavy artifacts (local only, not in git): `<workspace>/sandbox-logs/2026-10-19-doorbell-claude-matrix/artifacts/<cell>/`
- Loop fixture (state C): `<workspace>/sandbox-logs/2026-10-19-doorbell-claude-matrix/fixture`. It is the run-8 `mini` fixture re-shaped to one implementation task, whose engineer runs a required 40 s wait, plus a verification task (commit `c60dcc9`).
- Driver: `driver/run-cell.sh <cell>` and `driver/make-steps.mjs`.

Versions: Claude Code 2.1.293 (model `sonnet`), Node 24.18.0. epic-loop is installed from this worktree's source through the local CLI, for state C only.

## Journal

### 1. Roll-out

- [SANDBOX] DECISION:
  - One fresh sandbox per cell (D-11), so cells cannot disturb each other. A session-long rewake fires once per session, so a sequence of rings in one session would not test the same thing.
  - Rows 1–3 run without the fallback hook, so the pointer must come from the mechanism itself. The rows are:
    - 1: `rewake-event`;
    - 2: `rewake-session`;
    - 3: `background`;
    - 4: `fallback-only`, where the human sends "ok".
  - State F installs the fallback too, so the first human message after resume can be observed.
- [SANDBOX] Kit extensions, all backward compatible:
  - `install.mjs --rewake-timeout <s|default>` and `--rewake-pad <bytes>`;
  - `waiter.mjs --pad`;
  - the hook logger also records `promptId`, the PreToolUse `command`, and the `Stop` `background_tasks` statuses;
  - the probe instruction tells the model to read the background task's output file.
  - `ptydrive.py` gained a `run` step, so the "human submits" moment sits inside the step list.

### 2. Cells

Times are UTC from each cell's `06-probe-log.jsonl`; latencies (from submit) are from `07-summary.txt`. "Same turn" means the same Claude Code `prompt_id`. Rows 1A and 3A are taken from run 9 (`2026-10-19-doorbell-smoke`).

**State A, idle after a finished turn**

- [FEATURE] PASS 2A (asyncRewake on `SessionStart`).
  - The waiter was armed at `SessionStart` (16:50:42).
  - The setup turn ended at 16:50:54.
  - Submit at 16:51:17.393 → `waiter-fired` +15 ms → a new turn (`UserPromptSubmit` with `<task-notification>`, new `prompt_id`) at +60 ms → pickup at +4.3 s (`--via asyncRewake`).
- [FEATURE] PASS 4A (fallback only).
  - Submit at 16:52:24.859: nothing happened until the human typed "ok" at 16:52:31.
  - The fallback injected the pointer (`injected: true`) → pickup at +17.0 s (`--via user-prompt`).

**State B, ring during a turn**

The turn runs a 45 s foreground command, and the ring comes about 12 s into it.

- [FEATURE] PASS 1B, 2B and 3B, each delivered **inside the same turn, right after the running tool call ends**.
  - The transcript shows a `queued_command` attachment at ring time (for example 16:52:25 in 1B).
  - When the command finishes (+33 s), a `UserPromptSubmit` with `<task-notification>` fires **with the same `prompt_id`**.
  - The model picks up in that turn and then finishes the original request.
  - Pickup: 1B +41.0 s, 2B +37.0 s, 3B +36.4 s.
  - No second turn and no duplicate wake.
- [FEATURE] 4B (fallback only): no wake. After the long turn ended (`Stop` at +34 s), the human's "ok" carried the injected pointer → pickup at +44.2 s.

**State C, an epic-loop implementation loop chaining roles through `Stop` blocks**

The loop runs from this worktree's source. The ring comes during the engineer's 40 s wait.

- [FEATURE] PASS 3C (`run_in_background` waiter started by the session before binding).
  - Loop chain: manager 1 → techlead 2 → engineer 3 → techlead 4 → engineer 5 → techlead 6 → manager 7 (phase closure) → techlead 8 (`request-stop`, class A) → manager 9 (stop review accepted, stop report 01) → `idle`.
  - Ring at 16:55:24.291 during engineer turn 3 → `waiter-fired` +179 ms → delivered **in the same host turn** after the 40 s command ended (`UserPromptSubmit` at 16:55:52) → pickup at +32.0 s (`--via background-task`). The engineer then repeated its wait and finished its report.
  - **epic-loop classification:** `synthetic-prompt-ignored` with reason `harness-injected-prompt` and `turn_key_adopted: false`. The engineer turn stayed open and was not treated as an abort or a stop. `next_role` was preserved, and the loop chained normally to `idle`.
  - The waiter was still running at the setup turn's `Stop` events (`background_tasks: ["running"]`). The loop did not wait for it, because it was started before the loop's first turn (outside the role baseline).
- 1C (asyncRewake on `Stop`):
  - [SANDBOX] Attempt 1 was invalid. In `dontAsk` mode, the manager's and techlead's compound shell commands (`S=…; cat …; npm test | tail`) were denied. The techlead then concluded that "Bash is denied" and ended without `set-next-role` (`skip next-role-not-set` at 16:55:20). The session was stopped by hand, and its artifacts are kept as `artifacts/1C-attempt1`.
  - [SANDBOX] WORKAROUND: the loop prompt gained rule 5, "one simple command per Bash call". 3C had run without that rule and did not hit the denial.
  - [FEATURE] PASS, attempt 2.
    - Loop chain: manager 1 → techlead 2 → engineer 3 → techlead 4 → engineer 5 → techlead 6 → manager 7 (implementation-end housekeeping) → techlead 8 (class A) → manager 9 (accepted) → `idle`.
    - The asyncRewake hook fires on every `Stop` block of the chain (one `Stop` per role); the lock keeps a single waiter (`waiter-skip`).
    - Ring at 17:00:24.712 during engineer turn 3's wait → `waiter-fired` +227 ms → delivered in the same host turn after the command (`UserPromptSubmit` at 17:00:52) → pickup at +30.5 s.
    - **epic-loop classification:** `synthetic-prompt-ignored`, `harness-injected-prompt`, `turn_key_adopted: false`. The engineer turn completed normally at 17:00:58, and the chain continued to `idle`.
  - [FEATURE] OBSERVATION: the whole loop is one Claude Code host turn. Every role turn and the wake share one `prompt_id` (`7008e29f…`). Because epic-loop recognizes the synthetic prompt before comparing turn keys, it does not read the wake as `user-message-in-turn`.

**State D, after Esc**

The turn runs the 45 s command, Esc is pressed about 5 s in, and the ring comes 15 s later.

- [FEATURE] Esc interrupted the tool call: the transcript shows "The user doesn't want to proceed with this tool use" and "[Request interrupted by user for tool use]". **No `Stop` fired.**
- [FEATURE] PASS 1D, 2D and 3D. The armed waiter (the asyncRewake hook process, or the background task) **survived the Esc**, and the ring started a **new turn** (new `prompt_id`).
  - 1D: first hook +256 ms, pickup +5.2 s.
  - 2D: +87 ms, pickup +10.4 s.
  - 3D: +112 ms, pickup +3.5 s.
- [FEATURE] 4D (fallback only): no wake. The human's "ok" carried the pointer → pickup at +12.3 s.

**State F, session closed, answers submitted while closed, then `claude --resume <id>`**

The fallback hook is also installed. The resume phase waits 90 s for a wake, then the human types "ok".

- [FEATURE] On close, Claude Code SIGTERMs every waiter: the 1F and 2F rewake hooks and the 3F background task (`waiter-killed` at about +8 s after the setup turn). Nothing survives a closed session.
- [FEATURE] PASS 2F (asyncRewake on `SessionStart`).
  - Resume fires `SessionStart` with `source: resume` at 16:55:05.861.
  - The waiter re-arms and fires at once, since answers are pending (+2 ms).
  - A new turn starts with `<task-notification>` (+5.97 s from the submit, which is +0.1 s from the resume) → pickup at +11.3 s (`--via asyncRewake`).
  - The fallback hook also fired on that `UserPromptSubmit` and injected the pointer a second time in the same turn. That is a duplicate pointer, not a duplicate turn.
- [FEATURE] 1F, 3F and 4F: no wake on resume.
  - The event-armed waiter needs a `Stop`, which a resume does not produce.
  - Background tasks are not restored.
  - The first human message, "ok", 96 s after the resume, carried the fallback injection → pickup at about +107 s.

**State E, 15 minutes idle**

The five cells ran in parallel. The ring came 15 min after the setup turn.

- [FEATURE] PASS 1E (asyncRewake on `Stop`, `timeout` 86400): `waiter-fired` +213 ms, a new turn +280 ms, pickup +4.4 s.
- [FEATURE] **FAIL 1E0** (asyncRewake on `Stop`, no `timeout` set):
  - Claude Code SIGTERMed the hook process at `aliveMs: 600001`, so **the default asyncRewake timeout is exactly 600 s, and it kills the waiter**.
  - The ring at 17:07:18 produced no wake, and the 120 s pickup gate timed out.
  - Nothing re-arms the waiter while the session is idle, because no `Stop` fires.
- [FEATURE] PASS 2E (asyncRewake on `SessionStart`, `timeout` 86400): +185 ms, pickup +3.9 s.
- [FEATURE] PASS 3E (`run_in_background`): the background task was still alive after 15 min idle. Wake +75 ms, pickup +12.6 s. The documented "may be stopped under memory pressure after 30 minutes idle" was not tested beyond 15 minutes.
- [FEATURE] 4E (fallback only): no wake. The human's "ok" carried the pointer → pickup +10.7 s.
- [SANDBOX] BUG (driver): while the E batch ran, `run-cell.sh` was edited (rule 5 for state C). Bash reads a script incrementally, so the five running copies failed with a syntax error after their pty step list ended.
  - The cells' steps had all completed inside `ptydrive` (the idle, the `run` submit step, the pickup gate).
  - The EXIT trap stopped the servers.
  - The probe logs were copied and summarized by hand.
  - LESSON: never edit a driver script while runs of it are in flight. Copy it per batch, or wrap the body in a function so it is parsed in full.

**Extra cell S, the asyncRewake stderr size (1S)**

- [FEATURE] The waiter wrote a 20,220-byte pointer (20,000 bytes of padding plus the `END-OF-DOORBELL` marker) to stderr and exited 2.
- The transcript's `queue-operation` and the `user` message hold all 20,000 padding bytes and the end marker (`truncated` appears nowhere).
- **No truncation at 20 KB.** The upper limit was not searched beyond that.
- Pickup at +13.7 s.

**Hidden tool calls after a turn**

- [FEATURE] OBSERVATION: in several cells, a `PreToolUse` hook event fires about 1.5–5 s after a `Stop`, with no matching transcript entry. Its command is a plausible next command: 1D re-ran `node -e "setTimeout(…)"`, and 3B ran `cat .doorbell/answers.json`.
- This looks like Claude Code's speculative next-step execution. It fires `PreToolUse` hooks under the session id. It does not touch epic-loop, which has no `PreToolUse` hook, but any future `PreToolUse` hook must tolerate it.

### 3. Archive and cleanup

- [SANDBOX] `driver/archive.sh` archived all 22 cell sandboxes to `artifacts/<cell>/`. Each archive holds:
  - a git bundle, with a restore test (clone) for every cell;
  - `.doorbell/` and the hook settings;
  - `.epic-loop/` for 1C and 3C;
  - the host transcript.

  The script then removed each sandbox and its `~/.claude/projects/<sandbox-path>` directory. It uses `${VAR:?}` in every `rm -rf`, which passed the host's safety check.
- [SANDBOX] No `sandbox-dbm`, `doorbell/kit`, or `ptydrive` processes remain. The re-armed waiters were killed by Claude Code on exit, or by the drivers.
- [SANDBOX] Left on purpose: 22 trust entries for `sandbox-dbm-*` in `~/.claude.json`, which are harmless, as in earlier runs.
- [SANDBOX] A `pgrep -f` cleanup typed into the agent shell matched that shell's own command line and killed it (exit 144), as LEARNINGS already warns. No harm was done; the stuck 1C session had already ended.

## Summary

- [FEATURE] Claude Code 2.1.293 terminal matrix. Latency is submit → pickup; "new turn" means a new `prompt_id`, and "same turn" means delivered after the running tool call.

  | Mechanism | A idle | B mid-turn | C loop running | D after Esc | E 15 min idle | F closed, then `--resume` |
  | --- | --- | --- | --- | --- | --- | --- |
  | 1 asyncRewake on `Stop` | works, 3.8 s (run 9) | works, same turn, 41 s | works, same turn, 30 s, `synthetic-prompt-ignored` | works, new turn, 5.2 s | works with `timeout` 86400, 4.4 s; **does not** with the default (killed at 600 s) | does not (killed on close; no `Stop` on resume) |
  | 2 asyncRewake on `SessionStart` | works, 4.3 s | works, same turn, 37 s | not run (would behave as row 1: same hook path) | works, new turn, 10.4 s | works, 3.9 s | **works**: re-armed by `SessionStart` (`resume`), 11.3 s |
  | 3 `run_in_background` waiter | works, 5.1 s (run 9) | works, same turn, 36 s | works, same turn, 32 s, `synthetic-prompt-ignored` | works, new turn, 3.5 s | works, 12.6 s | does not (task killed on close, not restored) |
  | 4 `UserPromptSubmit` fallback | on the next human message | on the next human message after the turn | not run (needs a human message) | on the next human message | on the next human message | on the first human message after resume |

- [FEATURE] Other facts:
  - asyncRewake has an effective default timeout of 600 s, which kills the hook.
  - The rewake body is not truncated at 20 KB.
  - Esc fires no `Stop`, and armed waiters survive it.
  - Closing the session kills every waiter.
  - A wake during a turn is queued and delivered in the same turn after the current tool call.
  - epic-loop classifies every Claude Code wake as `synthetic-prompt-ignored`: no abort, no stop, and the loop keeps chaining. **No epic-loop misclassification was found.**
- [SANDBOX]
  - One generic cell driver (`run-cell.sh` and `make-steps.mjs`) with a pty `run` step covered 22 cells in about 20 minutes of wall time, with 22 parallel sandboxes in four batches.
  - The cost was about $5.60 of Sonnet, of which the two loop cells were $3.29 including the invalid 1C attempt.
  - Lessons: compound commands are denied in `dontAsk`, so give loop prompts a one-simple-command rule; never edit a driver while it runs.
