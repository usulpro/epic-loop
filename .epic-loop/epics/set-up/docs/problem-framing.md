# Epic Problem Framing

## Problem

Set up repository linting, formatting, deterministic skill package validation, and AI-assisted skill quality review.

## Desired Outcome

- The repository has a single deterministic validation entry point that covers syntax checks, unit tests, linting, formatting, and package validation.
- JavaScript/ESM source, tests, scripts, plugin skill files, and package metadata are checked by oxlint where supported.
- Formatting is handled by Oxfmt and can be checked in CI/local validation without changing files unexpectedly.
- Skill package invariants are checked by deterministic validation, while semantic skill quality review is available through an explicit AI-assisted command.

## Scope

- Root package scripts and pnpm workflow.
- oxlint configuration for the current ESM codebase.
- Oxfmt configuration and check/write scripts.
- Repository-specific skill package validation.
- AI-assisted skill quality review with structured output.
- Validation integration through `pnpm run validate`.
- Focused tests for custom validation logic.

## Non-Scope

- Rewriting large documentation sections for tone or style beyond what is needed to satisfy the checks.
- Adding sample application code.
- Enforcing an English-only lexical policy or strict ASCII-only punctuation policy.
- Adding CI provider configuration unless implementation discovers an existing CI surface that already calls `pnpm run validate`.

## Constraints

- This repository publishes and validates the `epic-loop` plugin/skill package; changes should stay inside that product surface.
- Prefer small deterministic Node.js scripts for repository-specific checks.
- Do not commit local `.epic-loop` runtime/debug artifacts, hook captures, prompt logs, or target-project epic workspaces.

## Open Questions

- Should formatting changes be applied immediately across the repository, or should the first implementation only add check scripts and report existing violations?
- Should the public plugin package require the same checks under `packages/cli`, or should root validation delegate into that package only where needed?
