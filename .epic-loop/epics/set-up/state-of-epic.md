# State Of Epic

Epic: Linting And Skill Checks
Slug: `set-up`
Created: 2026-07-06T02:54:26+00:00
Current mode: implementation
Active phase: Phase 2 - Deterministic Skill Package Checks
Active task: Phase 2 Task 2 - Add focused tests or fixtures for deterministic skill package validation

## Current State

- Initial shaping captured the repository baseline: Node.js ESM, pnpm, existing syntax/package validation, and no current oxlint/Oxfmt configuration.
- Phase 1 Task 1 is closed with accepted baseline debt: oxlint configuration, scripts, dependency, validation integration, and narrow baseline fixes are present; existing `max-lines` failures in `loop.mjs` and `hooks.mjs` are explicitly accepted for now and tracked as a Phase 1 refactor task before phase verification.
- Phase 1 Task 2 is closed: Oxfmt config and check/write scripts are present; format check is non-mutating and included in validation; markdown formatting is intentionally excluded because `oxfmt@0.57.0` produced unsafe markdown/template churn during verification.
- Phase 1 Task 3 is closed: `hooks.mjs` and `loop.mjs` are split below the oxlint source-file line limit; `pnpm run validate` passes after the refactor.
- Phase 1 Task 4 is closed: `pnpm run lint`, `pnpm run format:check`, `pnpm run test:unit`, and `pnpm run validate` all pass, and verification left no generated runtime/debug artifacts in the working tree.
- Phase 1 is complete; mandatory phase-closure housekeeping ran and found no compaction need or blockers.
- Phase 2 Task 1 is closed: deterministic skill package validation now checks mechanical Agent Skills invariants for the maintained `epic-loop` package through the existing package validator and aggregate validation path.
- Phase 2 is active: the next implementation slice should add focused tests or fixtures for deterministic skill package validation.
- The central product requirement is adding linting, Oxfmt formatting, deterministic skill package checks, and AI-assisted semantic skill review.
- Skill repository checks are split into deterministic script validation for mechanical invariants and a headless `codex exec` review runner that produces schema-validated JSON findings in an ignored output directory.
- The repository language policy phase was removed during shaping after a real repository audit found no evidence of non-English committed prose; strict ASCII punctuation cleanup is intentionally out of scope for this epic.

## Blockers

- None currently known.

## Next Action

- Continue with Phase 2 Task 2: add focused tests or fixtures for deterministic skill package validation.
