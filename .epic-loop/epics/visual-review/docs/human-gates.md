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

## Doorbell

- A blocking gate leaves the session idle. A submit (or a problem report, or an inbox entry) makes the server ring the session with the mechanism chosen in Phase 2. The waking turn routes to manager ingest.
- Fallback: `UserPromptSubmit` injects pending answers on the human's next message. The page says so when no doorbell is available for the platform.

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
