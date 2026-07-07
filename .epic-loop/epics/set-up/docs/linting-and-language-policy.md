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

## Proposed Oxlint Profile

Research date: 2026-07-07.

Recommended first-pass profile:

- Enable default oxlint plugins plus `import`, `node`, and `promise`: `eslint`, `typescript`, `unicorn`, `oxc`, `import`, `node`, `promise`.
- Treat `correctness` as `error`.
- Treat `suspicious` as `warn` at first, then promote selected low-noise rules after repository cleanup.
- Keep `style`, `restriction`, `pedantic`, and `nursery` disabled globally.
- Keep `perf` disabled globally for the first pass; consider warning-only later for targeted rules.

Rules to explicitly allow or tune for this repository:

- Disable `eslint/no-console`, because this repository contains command-line utilities and validation scripts where stdout/stderr are product output.
- Disable `unicorn/no-process-exit`, because CLI entry points intentionally set exit status.
- Disable `node/no-sync`, because small deterministic repository scripts intentionally use synchronous filesystem operations.
- Disable `unicorn/no-array-sort` while the CLI package supports Node.js `>=18`; `Array#toSorted()` is not a safe baseline assumption for every supported runtime.
- Allow `__dirname` for `eslint/no-underscore-dangle`, because the CLI uses the standard ESM `fileURLToPath` dirname shim.
- Enable `eslint/max-lines` explicitly as a targeted maintainability rule, with `max: 600` for source files and `max: 900` for test files.
- Enable `eslint/max-lines-per-function` explicitly as a targeted maintainability rule, with `max: 150` for functions.
- Configure both line-count rules with `skipBlankLines: true` and `skipComments: true` so the limits focus on maintained code shape rather than spacing or explanatory comments.
- Do not enable `restriction` globally: it flags optional chaining, object spread, async/await, console output, and other patterns that are acceptable for this repository.
- Do not enable `style` globally: it creates broad formatting/preference churn such as `sort-keys`, `no-magic-numbers`, `func-style`, `no-ternary`, and null bans.

Observed current repository findings with oxlint 1.73.0:

- Default correctness pass reports three small issues: one unused import, one unnecessary regex escape, and one unnecessary object spread fallback.
- `suspicious` adds mostly useful warning candidates: missing `cause` on rethrown errors, mutable `Array#sort()` suggestions, and `__dirname` naming noise.
- `perf` adds a small number of warning candidates, including `no-await-in-loop`, `prefer-set-has`, and `oxc/no-map-spread`; these are better handled after the baseline passes.
- `style` and `restriction` generate large noisy reports and should not block the initial linting setup.

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
