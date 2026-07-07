# State Of Epic

Epic: Linting And Skill Checks
Slug: `set-up`
Created: 2026-07-06T02:54:26+00:00
Current mode: implementation
Active phase: Phase 1 - Tooling Baseline
Active task: Phase 1 Task 3 - Refactor oversized hook and implementation loop modules to satisfy oxlint max-lines

## Current State

- Initial shaping captured the repository baseline: Node.js ESM, pnpm, existing syntax/package validation, and no current oxlint/Oxfmt configuration.
- Phase 1 Task 1 is closed with accepted baseline debt: oxlint configuration, scripts, dependency, validation integration, and narrow baseline fixes are present; existing `max-lines` failures in `loop.mjs` and `hooks.mjs` are explicitly accepted for now and tracked as a Phase 1 refactor task before phase verification.
- Phase 1 Task 2 is closed: Oxfmt config and check/write scripts are present; format check is non-mutating and included in validation; markdown formatting is intentionally excluded because `oxfmt@0.57.0` produced unsafe markdown/template churn during verification.
- Phase 1 Task 3 is in progress: `hooks.mjs` has been split below the oxlint source-file line limit; `loop.mjs` remains the only known `max-lines` failure.
- The central product requirement is adding linting, Oxfmt formatting, deterministic skill package checks, and AI-assisted semantic skill review.
- Skill repository checks are split into deterministic script validation for mechanical invariants and a headless `codex exec` review runner that produces schema-validated JSON findings in an ignored output directory.
- The repository language policy phase was removed during shaping after a real repository audit found no evidence of non-English committed prose; strict ASCII punctuation cleanup is intentionally out of scope for this epic.

## Blockers

- `pnpm run lint` and `pnpm run validate` currently fail until the planned Phase 1 refactor splits `loop.mjs` below the accepted `max-lines` limit.

## Next Action

- Continue with Phase 1 Task 3: refactor oversized `loop.mjs` to satisfy oxlint `max-lines`.
