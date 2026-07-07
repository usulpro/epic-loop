# State Of Epic

Epic: Linting And Skill Checks
Slug: `set-up`
Created: 2026-07-06T02:54:26+00:00
Current mode: implementation
Active phase: Phase 3 - AI-Assisted Skill Quality Review
Active task: Phase 3 Task 2 - Fix unbound hook capture persistence surfaced by AI skill review

## Current State

- Initial shaping captured the repository baseline: Node.js ESM, pnpm, existing syntax/package validation, and no current oxlint/Oxfmt configuration.
- Phase 1 Task 1 is closed with accepted baseline debt: oxlint configuration, scripts, dependency, validation integration, and narrow baseline fixes are present; existing `max-lines` failures in `loop.mjs` and `hooks.mjs` are explicitly accepted for now and tracked as a Phase 1 refactor task before phase verification.
- Phase 1 Task 2 is closed: Oxfmt config and check/write scripts are present; format check is non-mutating and included in validation; markdown formatting is intentionally excluded because `oxfmt@0.57.0` produced unsafe markdown/template churn during verification.
- Phase 1 Task 3 is closed: `hooks.mjs` and `loop.mjs` are split below the oxlint source-file line limit; `pnpm run validate` passes after the refactor.
- Phase 1 Task 4 is closed: `pnpm run lint`, `pnpm run format:check`, `pnpm run test:unit`, and `pnpm run validate` all pass, and verification left no generated runtime/debug artifacts in the working tree.
- Phase 1 is complete; mandatory phase-closure housekeeping ran and found no compaction need or blockers.
- Phase 2 Task 1 is closed: deterministic skill package validation now checks mechanical Agent Skills invariants for the maintained `epic-loop` package through the existing package validator and aggregate validation path.
- Phase 2 Task 2 is closed: deterministic skill package validation now has focused unit coverage for valid package behavior and representative invalid mechanical invariants.
- Phase 2 Task 3 is closed: focused validator tests, the deterministic package validator, full unit tests, lint, format check, and aggregate validation all pass, and verification left no generated runtime/debug artifacts.
- Phase 2 is complete; mandatory phase-closure housekeeping ran and found no compaction need or blockers.
- Phase 3 Task 1 is closed: `pnpm run review:skills:ai` now wraps `codex exec --ephemeral`, requires schema-valid JSON in `.validation-output/skill-review/latest.json`, prints stable path-oriented diagnostics, exits non-zero for blocking findings, and remains separate from `pnpm run validate`.
- The first live AI review produced a valid blocking finding: unbound hook invocations currently persist raw capture data before the binding gate in `hooks.mjs`. That issue is now tracked as the active Phase 3 correction task before rubric expansion.
- The central product requirement is adding linting, Oxfmt formatting, deterministic skill package checks, and AI-assisted semantic skill review.
- Skill repository checks are split into deterministic script validation for mechanical invariants and a headless `codex exec` review runner that produces schema-validated JSON findings in an ignored output directory.
- The repository language policy phase was removed during shaping after a real repository audit found no evidence of non-English committed prose; strict ASCII punctuation cleanup is intentionally out of scope for this epic.

## Blockers

- None currently blocking implementation progress; the AI review finding is tracked as active work.

## Next Action

- Continue with Phase 3 Task 2: fix unbound hook capture persistence surfaced by AI skill review.
