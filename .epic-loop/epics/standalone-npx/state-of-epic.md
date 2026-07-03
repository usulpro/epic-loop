# State Of Epic

Epic: epic-loop Standalone CLI Package (`npx epic-loop`)
Slug: `standalone-npx`
Created: 2026-07-03T16:45:12+00:00
Current mode: shaping
Active phase: Phase 2 - Bootstrap The Package And Ship The Zero-Arg Status Command
Active task: TBD (Phase 2 has not started; still in shaping)

## Current State

- Problem framing, scope/non-scope, constraints, decisions, and risks are captured (`docs/problem-framing.md`, `decision-log.md`, `risk-register.md`).
- Full 5-phase roadmap is drafted in `tracker.md`: (1) shape the epic — done, (2) bootstrap + zero-arg status command + manual publish, (3) CLI/TUI stack research with competing prototypes, (4) full user command surface, (5) migrate the skill onto the CLI with before/after eval metrics.
- Key decisions locked: package at `packages/cli`, npm name `epic-loop` (public, confirmed available), Phase 2 manual publish by the user, start on plain JS/ESM (not a TS constraint later), Phase 5 eval work coordinates with the `test-coverage` epic instead of building a competing harness.
- `roadmap-state.json` was removed (stale, phase-1-only) so it reimports fresh from this hand-authored `tracker.md` the next time a roadmap script touches it.

## Blockers

- None recorded.

## Next Action

- Continue shaping: review the drafted 5-phase roadmap and Phase 2 task detail with the user; refine as needed before moving to implementation.
- Phase 2 (bootstrap) can start once the user confirms the roadmap and explicitly starts implementation.
