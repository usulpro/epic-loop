# State Of Epic

Epic: epic-loop Standalone CLI Package (`npx epic-loop`)
Slug: `standalone-npx`
Created: 2026-07-03T16:45:12+00:00
Current mode: implementation
Active phase: Phase 2 - Bootstrap The Package And Ship The Zero-Arg Status Command (closed)
Active task: none - Phase 2 complete, loop idle; distribution foundation added out of loop on 2026-10-02 (see below)

## Scope Constraint (2026-07-04)

- User explicitly confirmed implementation start but scoped this run to **Phase 2 only**.
- Complete Phase 2 (all four tasks, including its verification task), do required phase-closure housekeeping, then set `next_role idle` and stop. Do not begin Phase 3 without a new explicit user confirmation in a future session/turn.
- Status: satisfied. Phase 2 is closed; the loop is being set `idle` this turn after phase-closure housekeeping.

## Current State

- Phase 1 (shape the epic): done. Problem framing, scope/non-scope, constraints, decisions, and risks captured (`docs/problem-framing.md`, `decision-log.md`, `risk-register.md`).
- Phase 2 (bootstrap + zero-arg status command + publish prep): **done**, closed 2026-07-04. All four tasks closed with task-owned commits:
  - `packages/cli` bootstrapped as a standalone npm package (`a9eaef0`).
  - esbuild-based build process, `src/` -> `dist/`, `prepack` hook (`ebe3b2b`).
  - Zero-argument root command: upward `.epic-loop` discovery + epic listing with mode/implementation-loop state (`f3fa046`).
  - End-to-end verification + publish-readiness check; fixed an invalid `bin` path caught by `npm publish --dry-run` (`dc05107`).
  - Follow-up recorded (not blocking): `docs/bootstrap.md` was referenced by all four tasks but never written — tracked as `follow-up-01` in `tracker.md`.
- **Published and manually verified (2026-07-04, post-closure)**: user published `epic-loop` to the public npm registry as `v0.1.0` and confirmed with a real `npx epic-loop` run — correctly listed all 4 real epics with slug/title/mode and `standalone-npx`'s own live implementation-loop state. This satisfies Phase 2's manual-publish step, which was explicitly out of the automated loop's scope.
- **Distribution foundation (2026-10-02, direct user session, outside the loop, uncommitted at time of writing)**. Why: settle how the skill reaches the CLI and how versions, installs, and updates work before any more logic moves into the package. Details and rationale: `decision-log.md` → "Distribution Foundation"; evidence: `implementation-log.md` (2026-10-02 entry).
  - Skill wrapper `scripts/epic-loop.mjs`: runs `npx --prefer-offline epic-loop@<pinned version>` with the skill dir in `EPIC_LOOP_SKILL_DIR`; `EPIC_LOOP_CLI` dev override.
  - One version across skill, plugin manifests, and npm package (`scripts/release.mjs`, enforced by `validate` and the CLI build; `/release-epic` skill drives a full release with `npm publish` as the only manual step).
  - `doctor` migrated into the CLI (temporary lib duplication), now also reporting skill version, install type, and available updates; SKILL.md/references call it through the wrapper.
  - New CLI commands: `install --platform`, `update` (atomic local-copy swap; plugins pointed at host commands), `config` (machine-local `autoupdate`); daily npm update check; autoupdate for local copies.
  - npm package ships a copy of the skill; Claude Code plugin + marketplace manifests added.
- Phases 3-5 remain in the roadmap; their task text was adjusted on 2026-10-02 to build on the distribution foundation (preserve existing commands and `--json` contracts, start the command spec and migration map from what exists, capture eval baseline explicitly). Two follow-ups were added: CI-based publishing on tag, and end-to-end plugin install verification on both hosts.
- `roadmap-state.json` is not present in this checkout (the `.runtime` traces were lost when the repo moved); `tracker.md` is authoritative. Known skill bug: the tracker importer attaches `## Follow-Up Tasks` items to the last phase instead of `follow_ups`, so do not regenerate `tracker.md` from imported state without checking.

## Blockers

- Release pending: the wrapper on the working tree pins `0.1.0`, whose published CLI has no `doctor`. Until `0.2.0` is released, skill copies built from this tree need `EPIC_LOOP_CLI`; the repo's runtime copies were intentionally not self-updated.

## Next Action

- Merge `feature/distribution-foundation` into `main`, then release `0.2.0` with `/release-epic minor` (user only runs `npm publish` when prompted).
- Then: resume shaping to refine Phase 3 (CLI/TUI stack research) against the adjusted task text, or explicitly confirm implementation to proceed into Phase 3.
- Before starting Phase 3 work, consider picking up the recorded follow-up (`docs/bootstrap.md`) — small, non-blocking, but currently referenced by closed Phase 2 tasks without existing.
