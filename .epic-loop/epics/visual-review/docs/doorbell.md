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

To be filled by the Phase 2 verification tasks. Rows: mechanism. Columns: idle, mid-turn, loop running, after Esc, 15 min idle, closed then resumed.

## Choice

To be written after the matrix.
