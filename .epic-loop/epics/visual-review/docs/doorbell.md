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

## Matrix

To be filled by the Phase 2 verification tasks. Rows: mechanism. Columns: idle, mid-turn, loop running, after Esc, 15 min idle, closed then resumed.

## Choice

To be written after the matrix.
