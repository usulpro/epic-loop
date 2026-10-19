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
- Phase 3 (review engine) closed on 2026-10-20 (`aac1655`).
- Phase 4 (human gates): done except the Codex half of its verification, on hold for H4 (a `danger-full-access` Codex run; it can be approved together with H3).
- Phase 5 (epic viewer) closed on 2026-10-20 (`98cd97c`): stable T ids, live home, activity feed and statistics, docs browser with id expansion, localization, verified in sandbox run 17.
- Pull request for Phases 2–5: https://github.com/usulpro/epic-loop/pull/16 (open, mergeable, CI green). The human reviews and squash-merges it; the agent does not merge.
- After the merge (`docs/delivery.md`): in the main checkout `git pull` and `pnpm run self-update`; Phases 6 and 7 continue on a new branch from `main`.
- Open: H3, H4; follow-ups "accept a stop without stdin" and "viewer polish"; agent-made decisions D31, D32, D34–D40 to confirm.
