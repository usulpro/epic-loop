# Epic Problem Framing

## Problem

Set up repository linting: add a linter and Prettier, plus additional repository checks such as enforcing English-only lexical usage in committed project content.

## Desired Outcome

- The repository has a single deterministic validation entry point that covers syntax checks, unit tests, linting, formatting, package validation, and repository-specific content checks.
- JavaScript/ESM source, tests, scripts, plugin skill files, and package metadata are checked by oxlint where supported.
- Formatting is handled by Prettier and can be checked in CI/local validation without changing files unexpectedly.
- A dedicated lexical policy check fails when committed project content contains non-English prose or identifiers outside documented allowlists.

## Scope

- Root package scripts and pnpm workflow.
- oxlint configuration for the current ESM codebase.
- Prettier configuration and check/write scripts.
- Repository-specific language policy tooling for English-only lexical usage.
- Validation integration through `pnpm run validate`.
- Focused tests for custom validation logic.

## Non-Scope

- Rewriting large documentation sections for tone or style beyond what is needed to satisfy the checks.
- Adding sample application code.
- Enforcing English inside runtime/debug artifacts, generated lockfiles, vendored dependencies, or files that are intentionally machine generated.
- Adding CI provider configuration unless implementation discovers an existing CI surface that already calls `pnpm run validate`.

## Constraints

- This repository publishes and validates the `epic-loop` plugin/skill package; changes should stay inside that product surface.
- Prefer small deterministic Node.js scripts for repository-specific checks.
- Do not commit local `.epic-loop` runtime/debug artifacts, hook captures, prompt logs, or target-project epic workspaces.
- The language check must have an explicit allowlist path for legitimate names, package identifiers, URLs, paths, code tokens, and technical terms.

## Open Questions

- Which file classes should be checked for English-only lexical usage on the first implementation pass: documentation/prose only, code identifiers/comments too, or every committed text file except explicit ignores?
- Should formatting changes be applied immediately across the repository, or should the first implementation only add check scripts and report existing violations?
- Should the public plugin package require the same checks under `packages/cli`, or should root validation delegate into that package only where needed?
