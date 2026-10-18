# Stop Gate, Human Queue And Stop Reports (Phase 1)

Spec for Phase 1. Decisions: D1–D3, D16, D17 in `decision-log.md`.

## Flow

```
techlead wants to stop
  └─ request-stop (class A–F, reason, what it blocks)  → next role: manager (stop review)
       manager stop review
         ├─ A done                         → accept → stop report → idle
         ├─ B / F, independent work left   → queue item → back to techlead ("continue with <task>")
         ├─ B / F, nothing independent     → accept → stop report → idle
         ├─ C default exists               → back to techlead ("take the default, record it as agent-made")
         ├─ D workaround or deferral       → back to techlead ("work around / defer verification")
         └─ E ordering / bookkeeping       → back to techlead ("reorder / fix bookkeeping")
```

- **One challenge round.** If the techlead requests the same stop again with new evidence, the manager accepts it.
- **The manager never overrides A, B or F.** It only checks whether independent work remains.
- **Every review is logged** as a `stop-gate` progress event: class, outcome (`accepted` or `challenged`), instruction, and the techlead's original reason.
- **Allowed transitions change:**
  - `techlead → idle` is removed;
  - `manager → idle` is added, only after a stop review;
  - housekeeping turns (implementation start, phase closure, implementation end) keep their current behaviour;
  - the implementation-end stop is class A.
- **A user stop request** (`stop-loop.mjs`, "stop loop mode") is not a stop gate: the user's stop is final.

## Agent-Made Decisions (D17)

- A class C decision is written to `decision-log.md` as a taken decision with a stable id and a marker: made by the agent, with the stop class and the default it chose. It is not "pending"; later work builds on it.
- A script writes it deterministically. The techlead does not hand-edit the format.

## Human Queue

- Task status `on-hold` with `Hold: <kind> (H<n>)` (D26). Kinds: `checkpoint`, `costly-decision`, `security-hold`, `human-action`, `product-decision`, `external-wait`. `blocked` is only for technical blockers.

- Items from classes B and F that did not stop the loop. Each item records:
  - a stable id;
  - the question or the action needed from the human;
  - why it is needed;
  - the default, if any;
  - what it blocks: "needed before task X";
  - when it was raised.
- One human-facing file in the epic, written by a script.
- Shown:
  - at any justified stop;
  - at a phase boundary when an item affects the next phase;
  - at the epic end.

## Stop Report (D3)

- Written by the manager when it accepts a stop. It is in the user's terms and measured against the epic's intent: `docs/problem-framing.md` (desired outcome) and the phases in `tracker.md`.
- **Content:**
  - where the epic stands against its goals;
  - what was achieved since the last report, in outcomes rather than files;
  - why the loop stopped, in one or two lines;
  - what the human needs to do or decide, from the human queue, with defaults;
  - agent-made decisions to confirm or reverse (D17);
  - what happens next and how to resume.
- **Language:** the chat message is in the user's language. The saved copy in the epic is English (D9).
- **Phase 1 is text only:** the final chat message plus a saved file. Phase 4 moves the report onto a page.
