# Human Gates In The Loop (Phase 4)

How review pages, answers, the inbox and the doorbell plug into the implementation loop. Decisions: D1, D7, D16, D22–D26.

## Gates

- **Only the manager opens a gate** (D1). It does so for a stop request of class B or F, an accepted stop (stop report), a planned `checkpoint`, or a result the techlead wants shown.
- **Opening a gate:**
  - the manager asks the page builder for a review;
  - it registers the gate with a script: review id, the H items it covers, blocking or not;
  - it gives the human a deep link (D24).
- **Non-blocking gate.** Independent work remains, so the loop continues. The gate shows on the epic home as a notification.
- **Blocking gate.** Nothing independent remains. The loop status becomes `awaiting-review` and the turn ends.
- **Every step is logged as a progress event:** `gate-opened`, `answers-submitted`, `gate-ingested`, `gate-closed`.
- **Script and state (Phase 4 Task 1).**
  - The command is `scripts/gate.mjs open|ingested|close|list`; `open`, `ingested` and `close` run only in an open manager turn.
  - `open` requires a review with a `schema` (it passed `review check`) and open H ids in `--covers`. Reopening a review updates its entry.
  - The record lives in `implementation_loop.gates`: `{ review, covers, blocking, status: open|submitted|ingested|closed, opened_at, opened_iteration, submitted_at?, ingested_at?, closed_at?, close_reason? }`.
  - The Stop of the manager turn that opened an unanswered blocking gate sets `implementation_loop.status = "awaiting-review"` and logs `awaiting-review` with the review ids. No continuation follows. Resuming uses `bind-session --mode implementation`, and `stop-loop` stops the loop. An accepted stop in the same turn wins.
  - The hook logs `answers-submitted` (`review`, `submitted_at`) on any hook event of the driver session, once per `submittedAt`. It does not route yet; that is Task 2.
  - `role-summary` lists open gates, and the epic home shows a Gates section ("the loop waits for this review" or "the loop keeps working").

## Pickup At Role Transitions

- On every Stop of the driver session, the loop checks the disk for two things:
  - reviews with `submittedAt` not yet ingested;
  - new inbox entries (D22).
- If any are found, the next role is the manager in ingest mode, before the role the loop would otherwise run.
- **The manager ingests and records** (D23):
  - decisions go into `decision-log.md`;
  - H items are resolved;
  - agent-made decisions are confirmed or reversed;
  - inbox requests are recorded;
  - then it writes a "what changed" note and hands over to the techlead.
- **The techlead plans:** follow-ups, rework after a reversed decision, reordering.
- **Ingest is idempotent.** A second ring or a re-check finds nothing new and changes nothing.
- **Implementation (Phase 4 Task 2).**
  - **Inbox:** `POST /api/<slug>/inbox` (JSON `{ text }` or the no-JS form on the epic home) appends `{ id: "I<n>", text, createdAt }` to `.epic-loop/epics/<slug>/inbox.jsonl`.
  - **What counts as pending:**
    - a gate (not closed) whose `answers.json` `submittedAt` differs from its `ingested_submitted_at`;
    - an inbox entry numbered above `implementation_loop.inbox_through`.
  - **When the ingest turn runs:**
    - Pending input routes a manager ingest turn (prompt template `implementation-manager-ingest-prompt.md`) before a techlead or engineer turn.
    - On `awaiting-review` it resumes the loop first (`review-answered`).
    - A pending stop review keeps its turn.
  - **Snapshot and events:**
    - The snapshot is `implementation_loop.ingest = { iteration, gates: [{ review, submitted_at }], inbox_ids, inbox_through, skipped_role }`.
    - Its Stop logs `gate-ingested` (`by: "ingest-turn"`) and `inbox-ingested` (`ids`, `through`).
    - It leaves `ingest_note` for the techlead's one-time "Human Input Ingested" section.
  - **`security-hold`:** `human-queue.mjs resolve` refuses it without `--confirmation`.

## Doorbell

- A blocking gate leaves the session idle. A submit (or a problem report, or an inbox entry) makes the server ring the session with the mechanism chosen in Phase 2. The waking turn routes to manager ingest.
- Fallback: `UserPromptSubmit` injects pending answers on the human's next message. The page says so when no doorbell is available for the platform.
- **Implementation (Phase 4 Task 3):**
  - The waiter hook (Claude Code) and `codex queue` from the server (Codex) are described in `doorbell.md` "Implemented".
  - The submit response carries `doorbell`: `waiter`, `codex-queue`, `loop-running` or `none`. The page shows "picks your answers up now", "at its next step" or "send any message in the agent session to continue".
  - Problem reports do not ring yet (Task 4).

## Stop Report Page And Auto-Continue

- An accepted stop produces a report page with:
  - the report against the epic intent;
  - the open H items with controls;
  - the agent-made decisions with confirm/reverse;
  - the "continue after submit" switch, on by default (D25).
- On submit: ring, then manager ingest, then the techlead. If the answers unblock work and the switch is on, the loop resumes without a chat message. If the switch is off, the answers are recorded and the loop stays paused.

## Hold Kinds In The Loop (D26)

- `security-hold`: never resolved by ingest alone. It needs an explicit confirmation control, and the exact command is shown.
- `human-action`: the "done" control resolves the H item. The techlead verifies the effect, for example that the package is published, before relying on it.
- `external-wait`: no page needed. The techlead rechecks the condition at its turns, and the epic home shows the wait.
- `checkpoint`, `costly-decision`, `product-decision`: resolved by the page answers.

## Problem Reports

- The "something is wrong" button (D21) rings like a submit.
- The manager has the page builder fix the page, re-checks it, and notifies the human with the deep link.
