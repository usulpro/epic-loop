# State Of Epic

Epic: Visual Human Interface For Epic-loop
Slug: `visual-review`
Created: 2026-10-17T18:03:53+00:00
Active phase: Phase 1 - Manager Stop Gate And Human-Readable Stop Reports
Active task: Phase 1 Task 5 - Prove the stop gate end to end in sandbox runs on Claude Code and Codex

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

- None recorded.

## Next Action

- Shaping of Phases 1–5 is complete; the epic is ready for implementation of Phase 1.
- Start Phase 1 in the main checkout per `docs/delivery.md`: create branch `feature/manager-stop-gate`, commit the shaping artifacts, install hooks, then bind a session with `--mode implementation`.
- Shape Phase 6 when Phase 5 is near; Phase 7 is decided after Phase 5.
