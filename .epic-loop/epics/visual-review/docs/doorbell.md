# Doorbell (Phase 2)

How a waiting session picks up the human's answers without a chat message. Decisions: D7, D8, D19.

## Contract

- Answers are written into the epic with `submittedAt`; that file is the source of truth.
- The doorbell carries only a short pointer to the file.
- Fallback on every platform: `UserPromptSubmit` injects pending answers on the human's next message, whatever its text.

## Candidates

See `prior-art.md`, "Doorbell research".
- Claude Code: `asyncRewake` hook (event-triggered or session-long waiter), `run_in_background` waiter.
- Codex: `codex queue`; `app-server` `turn/start` only as an alternative.

## Probe Kit And Smoke Results (2026-10-19)

- Kit: `.claude/skills/sandbox-test/tools/doorbell/`. Its README describes the parts: installer, answers server, waiters, fallback, hook logger, pickup, latency summary.
- Smoke run (one idle session per mechanism): `.claude/skills/sandbox-test/runs/2026-10-19-doorbell-smoke/log.md`.

| Mechanism | Ring → first hook | Ring → pickup | Notes |
| --- | --- | --- | --- |
| Claude Code `asyncRewake` (event, on `Stop`) | 168 ms | 3.8 s | The pointer reaches the model in the rewake body |
| Claude Code `run_in_background` waiter | 63 ms | 5.1 s | The notification has no stdout; the pointer came from the fallback injection |
| Codex `codex queue` (idle TUI) | 10.1 s | 13.6 s | Default sandbox is enough; the watcher delay is about 10 s |

Facts the matrix and the design must account for:

- **Claude Code wakes arrive as a `UserPromptSubmit` event.** Both the `asyncRewake` exit 2 and a finished background task do this, and the event's `prompt` is the `<task-notification>` XML.
  - The `asyncRewake` body is `Stop hook blocking error from command "<name>": <stderr>`, unless the undocumented `rewakeMessage` sets another prefix.
  - The woken turn's `Stop` has `stop_hook_active: true`.
- **asyncRewake timeout.** The hook `timeout` also bounds async and asyncRewake hooks; the default is 600 s, after which the hook is killed. Claude Code kills its async hook processes when it exits.
- **The Codex queued message arrives as a plain user prompt** (`UserPromptSubmit` with the pointer text and a new `turn_id`). Nothing marks it as coming from the queue.
- **Open:** whether the asyncRewake `timeout` has an upper cap, and whether the rewake stderr has a size limit.

## Matrix

### Claude Code 2.1.293, terminal (interactive TUI)

Run log: `.claude/skills/sandbox-test/runs/2026-10-19-doorbell-claude-matrix/log.md` (run 10). Idle cells 1A and 3A come from run 9 (`2026-10-19-doorbell-smoke`).

Latency is submit → pickup. "New turn" means a new host turn (new `prompt_id`). "Same turn" means the wake is queued and delivered in the running turn right after its current tool call ends.

| Mechanism | A idle | B mid-turn | C loop running | D after Esc | E 15 min idle | F closed, then `--resume` |
| --- | --- | --- | --- | --- | --- | --- |
| 1 `asyncRewake` hook on `Stop` | works, new turn, 3.8 s | works, same turn, 41 s | works, same turn, 30 s | works, new turn, 5.2 s | works with `timeout` 86400 (4.4 s); does not with the default timeout | does not |
| 2 `asyncRewake` hook on `SessionStart` | works, new turn, 4.3 s | works, same turn, 37 s | n/a (see note) | works, new turn, 10.4 s | works with `timeout` 86400 (3.9 s) | works, 11.3 s |
| 3 `run_in_background` waiter | works, new turn, 5.1 s | works, same turn, 36 s | works, same turn, 32 s | works, new turn, 3.5 s | works, 12.6 s | does not |
| 4 `UserPromptSubmit` fallback | next human message | next human message | n/a (see note) | next human message | next human message | first human message after resume |

Notes:

- **Where the pointer comes from.**
  - Rows 1–2: the asyncRewake exit-2 body (`Stop hook blocking error from command "<name>": <stderr>`) arrives as a `UserPromptSubmit` whose prompt is `<task-notification>` XML plus a system reminder.
  - Row 3: the notification has only the task id and output-file path. The model reads the waiter's output file, which works without any instruction beyond "read the doorbell task's output".
  - Row 4: `additionalContext` on the human's message.
- **The asyncRewake timeout.** The default is exactly 600 s: Claude Code SIGTERMed the hook at 600,001 ms, after which a ring wakes nothing. A waiter must set `timeout` explicitly. No upper cap was hit at 86400 s over 15 min.
- **The rewake body size.** A 20 KB stderr body reached the model untruncated. Larger sizes were not tested.
- **Esc and close.**
  - Esc fires no `Stop`, and armed waiters (hook processes and background tasks) survive it.
  - Closing the session SIGTERMs every waiter, and background tasks are not restored on resume.
  - Only a `SessionStart` hook re-arms on resume (`source: resume`). It fires at once when answers are pending.
- **The event-armed waiter (row 1) re-arms on every `Stop`, including every Stop-hook block of an epic-loop chain.** A lock keeps one waiter. While the session idles, nothing re-arms a waiter that died.
- **epic-loop classification (state C, rows 1 and 3).**
  - The wake is logged as `synthetic-prompt-ignored` (`harness-injected-prompt`, `turn_key_adopted: false`).
  - The engineer turn stays open, and the loop chains normally to `idle`, with no abort, stop, or lost `next_role`.
  - The whole loop is one host turn (one `prompt_id`), so the synthetic check is what keeps the wake from being read as a user message. **No misclassification was found.**
- **n/a cells.**
  - 2C was not run. It uses the same asyncRewake delivery path as 1C and differs only in when it is armed, and it is one-shot per session.
  - 4C needs a human message during the loop, which is epic-loop's documented `user-message-in-turn` path, not a doorbell.
- **Hidden tool calls.** Claude Code sometimes fires a `PreToolUse` hook about 2–5 s after a `Stop` for a speculative next command that never appears in the transcript. A future `PreToolUse` hook must tolerate it.

### Codex 0.162.0, terminal (interactive TUI)

Run log: `.claude/skills/sandbox-test/runs/2026-10-20-doorbell-codex-matrix/log.md` (run 11). Idle cell A comes from run 9.

The ring is `codex queue --thread <id> --message <pointer>`. It exits 0 in about 0.2 s and prints `Queued message <id> for thread <id>`. The thread id comes from `CODEX_THREAD_ID`, which the session registers. Latency is submit → pickup.

| Mechanism | A idle | B mid-turn | C loop running | D after Esc | E 15 min idle | F closed, then `codex resume` |
| --- | --- | --- | --- | --- | --- | --- |
| `codex queue` | works, new turn, 13.6 s | works, held until the turn completes, then its own turn, 39.5 s | deferred (see note) | not dispatched until the next completed turn | works, 13.4 s | works: queued while closed, dispatched on resume, about 3 s after resume |
| `UserPromptSubmit` fallback | next human message | next human message | n/a | next human message | next human message | next human message |

Notes:

- **How a queued message arrives.**
  - It arrives as a plain user prompt in a new turn (`UserPromptSubmit` whose prompt is exactly the pointer).
  - The TUI picks it up about 9–10 s after the queue call (the state-store watcher).
  - It never steers into a running turn. It starts its own turn about 40 ms after the running turn's `Stop`.
  - The rollout marks such turns `turn_attribution.turn_trigger: "queue"`. Typed turns are marked `"user"`. Whether the hook payload exposes that field is not yet checked; until then, a hook can tell a queued pointer from a typed message only by its text.
- **After Esc.** No auto-dispatch: 79 s of silence in the run. The next completed turn releases the queue, so the human's next message runs first and the pointer turn follows immediately. This matches the research.
- **Closed thread.** `codex queue` accepts a message for a thread that is not loaded, and `codex resume` dispatches it right after `SessionStart` (`source: resume`).
- **Daemon vs embedded.**
  - No shared app-server daemon runs on this machine, so the plain TUI is embedded, and `codex queue` reaches it without a socket.
  - A TUI attached through `--remote unix://…` to its own `codex app-server` behaves the same: 9.5 s, plain `codex queue`.
  - The shared daemon was not started, because that would be a machine-wide side effect.
- **Version and sandbox.**
  - `codex queue` is present in 0.162.0. The research says it has been stable since 0.149; the minimum version was not re-tested.
  - The default `workspace-write` sandbox with `-a never` is enough for the session side (registering the thread, the pickup).
  - Loop commits are not possible under `workspace-write`: `.git` stays read-only even with `sandbox_workspace_write.writable_roots`.
- **The fallback** works on Codex: `additionalContext` on the next human message, including a message steered into a running turn.
- **C deferred.** It needs the human's approval for a `danger-full-access` sandbox run (sandbox-test D-7). Inference from cell B, unverified:
  - A Stop-hook chain continues one turn, so a queued message is likely held until the loop goes idle.
  - If it ever arrives while a role turn is open, epic-loop would see a new turn key and treat it as an aborted turn (`implementation-cycle.md`).


## Choice

To be written after the matrix.
