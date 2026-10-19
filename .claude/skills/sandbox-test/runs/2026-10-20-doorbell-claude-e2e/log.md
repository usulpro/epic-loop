# Sandbox run: doorbell end to end inside a running epic-loop loop on Claude Code (2026-10-20)

Run 12 of the `sandbox-test` skill.

Questions this run answers:

- [FEATURE] Can a role inside a running epic-loop implementation loop on Claude Code 2.1.293 do all of the following?
  - raise a probe gate;
  - end its turn waiting;
  - be resumed by the doorbell with no chat message;
  - finish with the answers while the loop keeps chaining.

  Scenario E1 covers this, using the role's own background waiter.
- [FEATURE] What does the `UserPromptSubmit` fallback alone do inside a loop (E2)?
- [FEATURE] What happens when an asyncRewake waiter wakes a session whose loop went idle through a class B stop, and does the loop come back (E3)?
- [SANDBOX] Pre-shaped gate fixtures and a three-scenario driver.

Layout:

- Sandboxes (disposable): `<workspace>/sandbox-dbe-<E1|E2|E3>/`
- Heavy artifacts (local only): `<workspace>/sandbox-logs/2026-10-20-doorbell-claude-e2e/artifacts/<scenario>/`
- Fixtures: `<workspace>/sandbox-logs/2026-10-20-doorbell-claude-e2e/fixture-<E1|E2|E3>`. Each is the run 10 loop fixture with a gate task, "record the human's release codename in `ANSWER.txt`", followed by a verification task.
  - E1's task: start `waiter.mjs --mode background`, end the turn waiting without `complete-turn.mjs`, pick up on the notification, write `ANSWER.txt`, commit.
  - E2's task: end the turn waiting without starting anything, and pick up when a `Doorbell:` pointer arrives.
  - E3's task: needs the human, so the techlead files a class B stop.
- Driver: `driver/run-e2e.sh <scenario>` (body in `main()`), `driver/make-steps.mjs`, `driver/archive.sh`.

Versions: Claude Code 2.1.293 (`sonnet`), epic-loop from this worktree's source through the local CLI, with `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0`.

## Journal

### 1. Roll-out

- [SANDBOX] DECISION: the three scenarios ran in parallel, one sandbox each.
  - The kit variants were E1 `background`, E2 `fallback-only`, and E3 `rewake-event` (asyncRewake on `Stop`, `timeout` 86400).
  - The prompt is run 10's loop prompt with the one-simple-command rule. E3 adds one rule: "on a `Doorbell:` message run pickup, then continue as the epic-loop skill's rules say".
- [SANDBOX] WORKAROUND: the first launch wrapped the three drivers in one background command that exited at once. The drivers kept running, but their completion notification was lost, so a second background command waited on their pids instead.

### 2. Scenarios

**E1, the role's background waiter**

All times are UTC.

- [FEATURE] PASS: the engineer was resumed by the doorbell with no chat message, and the loop kept chaining.
  - 17:52:48: engineer turn 3 starts. It starts the waiter as a background task (`waiter-armed`) and ends its turn waiting.
  - 17:52:56: epic-loop logs **`turn-waiting-background`** (engineer, iteration 3). No continuation was issued while waiting; the next progress event is the wake.
  - 17:53:16.534: answers submitted → `waiter-fired` +1 ms → `UserPromptSubmit` with `<task-notification>` +60 ms.
    - epic-loop logged **`synthetic-prompt-ignored`** with **`turn_key_adopted: true`**: the notification started a new host turn, and the loop adopted it for the open engineer turn.
  - +3.3 s: pickup (`--via background-task`), read from the waiter's output file. The engineer wrote `ANSWER.txt` (`codename-E1-amber`) and committed it (`3dad387`).
  - 17:53:27: engineer turn 3 ends with its report.
  - The chain then ran on: techlead 4 → engineer 5 (verification) → techlead 6 → manager 7 (phase closure) → techlead 8 → manager 9 (end housekeeping) → techlead 10 (class A request).
- [FEATURE] FINDING, not a doorbell issue: the class A stop could not be accepted in this sandbox.
  - `review-stop.mjs --outcome accepted` takes the report only on stdin, and the sandbox prompt's one-simple-command rule forbids redirections and heredocs.
  - Manager turns 11 and 13 decided "accept" but could not run the command, so no `stop-gate` event was logged.
  - Techlead 12 re-filed (round 2). Techlead 14 ended without `set-next-role`, which logged `skip next-role-not-set`.
  - The loop then sat neither running nor idle until the driver's 25-minute idle gate timed out.
  - Product follow-up: give `review-stop.mjs` a `--file` option, or allow the report as an argument. Also, a stop-review turn that ends without resolving the request should be routed so it cannot loop. E2 shows the same pattern.

**E2, fallback only, no waiter**

- [FEATURE] FINDING: **the fallback alone does not hold a gate.**
  - 17:53:03–17:53:07: engineer turn 3 ended at once ("waiting for the human's answers"). With nothing running, epic-loop recorded that message as the report and chained to techlead 4 without the answers.
- [FEATURE] The fallback then worked as a fallback:
  - 17:53:10.799: answers submitted, with no wake.
  - 17:53:14: the human typed "ok" during techlead turn 4. epic-loop logged **`user-message-in-turn`** (techlead), and the fallback injected the pointer as additional context.
  - 17:53:15: the techlead filed a class B stop ("needs the human's codename via the answers page").
  - Manager 5 **challenged** it, because the answers were already submitted.
  - Techlead 6 re-briefed. Engineer 7 picked up (+29.4 s, `--via user-prompt`) and committed `ANSWER.txt` (`codename-E2-amber`).
  - The loop chained to class A, and stalled there on the same stdin limitation as E1.

**E3, asyncRewake waking a session whose loop went idle**

- [FEATURE] PASS: auto-continue is possible with no human message.
  - 17:52:35: techlead 2 filed a class B stop ("the codename can only come from the human").
  - 17:52:48: manager 3 accepted it (`stop-gate` accepted, stop report 01 committed).
  - 17:52:57: the loop went `idle`. The asyncRewake waiter had been armed by the first `Stop` of the chain (17:52:17). Later `Stop`s skipped it through the lock, and it stayed armed while idle.
  - 17:53:18.219: answers submitted → `waiter-fired` +148 ms → `UserPromptSubmit` with `<task-notification>` (+195 ms).
  - epic-loop logged nothing for this wake. The loop was not running, so the hook stayed silent.
  - +2.4 s: the model ran pickup.
  - 17:53:25: following the prompt's "continue as the skill's rules say", the model ran **`bind-session.mjs --current --slug mini --mode implementation`** itself.
  - The loop restarted (`loop-start`) from a manager turn (4) → techlead 5 → engineer 6 (`ANSWER.txt`, `84974bf`) → techlead 7 → engineer 8 (verification). The driver ended there, as planned.
  - The waiter re-armed on the next `Stop` (17:53:29).
- [FEATURE] NOTE: the rebind was the model's own choice, prompted by the run's rule 4. The skill itself says "resume only on request". A product auto-continue must make this step deterministic, not leave it to the model.

### 3. Archive and cleanup

- [SANDBOX] `driver/archive.sh` (run 10's script, re-targeted) archived the three sandboxes to `artifacts/<scenario>/`:
  - a git bundle, restore-tested;
  - `.doorbell/`, the settings and `.epic-loop/`;
  - the host transcript.

  It then removed the sandboxes and their `~/.claude/projects` directories.
- [SANDBOX] No `sandbox-dbe`, `doorbell/kit` or `ptydrive` processes remain. Claude Code killed the waiters on exit.
- [SANDBOX] Left on purpose: three trust entries for `sandbox-dbe-*` in `~/.claude.json`.

## Summary

- [FEATURE]
  - **E1:** a role's background waiter is a working doorbell inside a running loop today. epic-loop's `turn-waiting-background` holds the gate, the wake is `synthetic-prompt-ignored` with the turn key adopted, and the same role turn resumes. Ring to pickup took 3.3 s.
  - **E2:** the fallback alone cannot hold a gate. The loop moves on, and the answers reach the loop only if the human writes.
  - **E3:** an asyncRewake waiter wakes an idle session in 0.2 s. With a rebind, the loop resumes with no human message. epic-loop does not log or route that wake today.
  - **Unrelated product finding:** an accepted stop needs stdin, which fails under a no-redirection policy and then stalls the loop.
- [SANDBOX]
  - Cost about $5.27 of Sonnet (E1 $1.87, E2 $2.04, E3 $1.36), wall time about 4 min of loop work per scenario.
  - The E1 and E2 drivers then waited out their 25-minute idle gate on the stalled class A stop.
  - Gate steps phrased as a task in the fixture tracker were carried into the engineer brief by the techlead in all three runs.
