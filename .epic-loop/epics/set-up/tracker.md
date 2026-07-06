# Tracker

Epic: Linting And English Checks

## Task Statuses

- todo
- doing
- need-review
- blocked
- partially-satisfied
- deferred
- reset-required
- done

## Task Kinds

- implementation
- verification
- review
- follow-up
- architecture-reset
- documentation-only

## Active Roadmap

### Phase 1: Tooling Baseline

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Add oxlint configuration for the current Node.js ESM repository.
  - Outcome: JavaScript source, scripts, tests, and plugin package code are linted consistently with the repository's ESM/Node style.
  - Surface: `package.json`, oxlint config, scripts/tests/plugin source under root and `packages/cli`.
  - Acceptance: A lint script exists, runs without false positives on the intended source set, and is included in aggregate validation.
  - Docs: `docs/linting-and-language-policy.md`.

- [ ] Kind: implementation | Status: todo | Add Oxfmt configuration and non-mutating format validation.
  - Outcome: Repository formatting is standardized and can be checked without modifying files during validation.
  - Surface: `package.json`, Oxfmt config/ignore files, supported source and documentation files.
  - Acceptance: Format check and format write scripts exist; aggregate validation uses the check script only; ignored runtime/generated paths are explicit.
  - Docs: `docs/linting-and-language-policy.md`.

- [ ] Kind: verification | Status: todo | Verify lint and format tooling through the repository validation path.
  - Outcome: The first phase tooling is proven through the same command future contributors will run.
  - Surface: Local pnpm scripts, oxlint, Oxfmt, existing syntax/package validation.
  - Acceptance: Run `pnpm run validate` and any focused lint/format scripts; evidence includes exit codes and any required follow-up fixes, with no generated runtime artifacts committed.
  - Docs: `docs/linting-and-language-policy.md`.

### Phase 2: Repository Language Policy

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Implement deterministic English-only lexical validation for committed project content.
  - Outcome: Validation fails with actionable diagnostics when maintained project files contain non-English prose or disallowed lexical tokens.
  - Surface: Small Node.js validation script, package scripts, include/ignore policy, allowlist data if needed.
  - Acceptance: The script reports path, line, column, and offending token/excerpt; runtime/debug/generated paths are ignored; legitimate technical tokens have an explicit allowlist path.
  - Docs: `docs/linting-and-language-policy.md`.

- [ ] Kind: implementation | Status: todo | Add focused tests or fixtures for the English-only lexical validator.
  - Outcome: The custom repository policy has regression coverage for accepted English text, rejected non-English text, ignores, and allowlisted terms.
  - Surface: `tests/unit`, validator script fixtures/helpers, package validation scripts.
  - Acceptance: Tests cover pass and fail cases with deterministic assertions and run under the existing Node test runner.
  - Docs: `docs/linting-and-language-policy.md`.

- [ ] Kind: verification | Status: todo | Verify aggregate validation catches language policy violations and accepts the cleaned repository.
  - Outcome: The language policy is proven both by focused tests and by aggregate validation.
  - Surface: Validator script, test runner, `pnpm run validate`, temporary fixture or controlled failing input.
  - Acceptance: Run focused validator tests, prove a controlled non-English sample fails with the expected diagnostic, remove any temporary sample, and run `pnpm run validate` successfully.
  - Docs: `docs/linting-and-language-policy.md`.

