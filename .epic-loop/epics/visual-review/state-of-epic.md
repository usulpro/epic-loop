# State Of Epic

Epic: Visual Human Interface For Epic-loop
Slug: `visual-review`
Created: 2026-10-17T18:03:53+00:00
Active phase: Phase 5 - Epic Viewer
Active task: TBD

## Read First

- `docs/delivery.md`: where each phase runs (main checkout or worktree), branches, setup, when and how it merges, and the rule against updating the running loop.

## Current State

- Shaping started on 2026-10-18.
- Captured so far:
  - problem framing (`docs/problem-framing.md`);
  - prior art and doorbell research (`docs/prior-art.md`);
  - decisions D1–D30 and open questions Q1–Q10 (all but Q2, Q8 and Q10 resolved) (`decision-log.md`);
  - risks R1–R7 (`risk-register.md`).
- Phases 0–7 agreed (`tracker.md`).
- Phase 1 (stop gate) shaped: 4 implementation tasks and 1 verification task, spec in `docs/stop-gate.md`. Q1 is resolved by D16 and D17.
- Phase 2 (doorbell spike) shaped: probe kit, Claude Code and Codex terminal matrices, end-to-end loop check (D19).
- Phase 3 (review engine) shaped: server, runtime and components, static check, subagents, verification (D20, D21; spec `docs/review-engine.md`).
- Phase 4 (human gates) shaped: gate lifecycle, pickup and manager ingest, doorbell, stop report page with auto-continue, verification (spec `docs/human-gates.md`).
- Phase 5 (epic viewer) shaped: stable ids, live home, activity feed, docs browser with id expansion, localization, verification with design and accessibility review (D27–D30).
- Phase 6 (discussion without interrupting the loop) and Phase 7 (shaping tools) are placeholders.
- Delivery split (D18): Phase 1 goes to `main` on its own branch first; Phases 2–7 go into a separate worktree branched after that merge.

## Blockers

- None.

## Next Action

- Phase 1 was squash-merged into `main` as PR #13 (`f9dc7f9`). Phases 2-7 run in the worktree `../epic-loop-visual` on branch `feature/visual-review` (`docs/delivery.md`).
- Phase 2 (doorbell spike): done except the Codex end-to-end task, on hold for H3 (approval of a `danger-full-access` Codex run and quota). Claude Code mechanism proposed in D34.
- Phase 3 (review engine) closed on 2026-10-20 (`aac1655`): server, runtime and components, static check, page builder and translator subagents, verified end to end on Claude Code and Codex (sandbox run 15).
- Next: Phase 4 (human gates), first task "Gate lifecycle in the loop state". On Codex the review server cannot start inside `workspace-write`; Phase 4's doorbell server must start outside the sandbox (R5).
- Open: H3; follow-up-02 (accept a stop without stdin); agent-made decisions D31, D32, D34, D35, D36 to confirm.
- Tracker compacted at Phase 3 closure: the task lists of closed Phases 0, 1 and 3 are in `tracker.closed-phases.previous-layer-01.md`.
