# Linting And Language Policy

## Baseline

- Package manager: `pnpm@11.9.0`.
- Runtime style: Node.js ESM (`"type": "module"`).
- Existing checks:
  - `pnpm run test:unit`
  - `pnpm run validate`
  - `pnpm run validate:epic-loop`
  - platform doctor scripts for Codex and Claude Code.
- Current `validate` performs `node --check` over selected scripts and runs `scripts/validate-epic-loop-package.mjs`.
- No oxlint, Oxfmt, EditorConfig, or spelling/language config is currently present.

## Policy Direction

Use standard tooling for standard concerns and a small repository-owned script for project-specific language policy:

- oxlint for JavaScript/ESM source, tests, scripts, and package code.
- Oxfmt (`oxfmt`) for formatting supported text/code/doc files.
- A custom Node.js validation script for English-only lexical usage, because the repository rule is product-specific and should be deterministic.

## English-Only Check

The check should inspect committed project text that humans maintain, while ignoring runtime/debug/generated surfaces.

Candidate included surfaces:

- `README.md`, `CHANGELOG.md`, `CLAUDE.md`, `AGENTS.md`
- `package.json` files
- `scripts/**/*.mjs`
- `tests/**/*.mjs`
- `packages/cli/src/**/*.mjs`
- `plugins/epic-loop/skills/epic-loop/**/*.md`
- `plugins/epic-loop/skills/epic-loop/**/*.mjs`
- `plugins/epic-loop/skills/epic-loop/**/*.yaml`

Candidate ignored surfaces:

- `node_modules/`
- lockfiles
- `.git/`
- `.epic-loop/epics/*/.runtime/`
- `.epic-loop/.runtime/`
- generated package output
- hook captures, prompt logs, progress logs, and transcript/debug traces

The script should report filename, line, column, and offending token or short excerpt. It should support a small allowlist for legitimate non-dictionary or non-English tokens, but the default direction is to remove Russian or other non-English prose from committed source and docs.

## Validation Contract

`pnpm run validate` should become the single command that proves the repository is publishable:

- syntax checks still run
- package validation still runs
- unit tests either run directly or remain available through a documented validation script
- oxlint check runs
- Oxfmt check runs
- English-only lexical check runs

Formatting write commands should be separate from check commands so validation remains non-mutating.
