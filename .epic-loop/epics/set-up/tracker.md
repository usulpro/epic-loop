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
  - Acceptance: A lint script exists, runs without false positives on the intended source set, enforces targeted `max-lines` and `max-lines-per-function` limits, and is included in aggregate validation.
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

### Phase 2: Deterministic Skill Package Checks

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Add deterministic skill package validation for mechanical Agent Skills invariants.
  - Outcome: Maintained skill packages fail validation when their file shape, frontmatter, naming, references, or generated-artifact boundaries violate portable skill package rules.
  - Surface: `scripts/validate-skills.mjs` or `scripts/validate-epic-loop-package.mjs`, `package.json` scripts, skill package files under `plugins/epic-loop/skills`.
  - Acceptance: The validator checks `SKILL.md` presence, YAML frontmatter, required `name` and `description`, kebab-case name constraints, directory-name match, description length, `SKILL.md` line budget, direct reference links, long-reference table of contents, forward-slash paths, script syntax, and ignored runtime/debug artifact absence.
  - Docs: `docs/linting-and-language-policy.md`.

- [ ] Kind: implementation | Status: todo | Add focused tests or fixtures for deterministic skill package validation.
  - Outcome: The deterministic skill validator has regression coverage for accepted package shape and representative failure cases.
  - Surface: `tests/unit`, validator fixtures/helpers, package validation scripts.
  - Acceptance: Tests cover valid skill metadata, invalid names, missing descriptions, long entrypoint files, missing table of contents for long references, Windows-style paths, and generated artifact detection.
  - Docs: `docs/linting-and-language-policy.md`.

- [ ] Kind: verification | Status: todo | Verify deterministic skill package checks through aggregate validation.
  - Outcome: Skill package mechanical validation is proven as part of the standard repository validation path.
  - Surface: `pnpm run validate`, focused validator command, unit tests, current plugin skill package.
  - Acceptance: Run focused validator tests, run the deterministic skill validator, and run `pnpm run validate` successfully; evidence includes exit codes and any required package cleanup.
  - Docs: `docs/linting-and-language-policy.md`.

### Phase 3: AI-Assisted Skill Quality Review

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Add a headless Codex skill review runner with structured JSON output.
  - Outcome: Semantic skill quality review can be launched as a normal script command while internally using `codex exec` in non-interactive mode.
  - Surface: `package.json` scripts, AI review runner script, repo-local review skill or prompt, ignored `.validation-output/skill-review/` output path, JSON schema validation.
  - Acceptance: `pnpm run review:skills:ai` invokes `codex exec --ephemeral`, requires a structured JSON report, validates the report schema, prints stable findings, and exits non-zero for blocking findings, malformed JSON, missing output, unknown schema versions, or failed Codex execution.
  - Docs: `docs/linting-and-language-policy.md`.

- [ ] Kind: implementation | Status: todo | Define the AI skill quality review rubric and finding schema.
  - Outcome: The model-backed review evaluates skill semantics consistently instead of producing free-form prose.
  - Surface: Review skill or prompt file, JSON schema fixture, review runner tests, skill policy docs.
  - Acceptance: The rubric covers invocation quality, trigger boundaries, progressive disclosure, task-local reference organization, degree of freedom, script/dependency safety concerns, and actionable recommendations with path and line evidence where possible.
  - Docs: `docs/linting-and-language-policy.md`.

- [ ] Kind: verification | Status: todo | Verify the AI-assisted review command behaves like a deterministic script boundary.
  - Outcome: The AI-backed command is usable in maintainer workflows without ambiguous output handling.
  - Surface: `pnpm run review:skills:ai`, controlled valid and invalid JSON outputs, current skill package, ignored output directory.
  - Acceptance: Prove the runner accepts valid reports, rejects malformed or missing reports, prints findings deterministically, keeps generated artifacts ignored, and documents whether the AI-backed command is excluded from or included in `pnpm run validate`.
  - Docs: `docs/linting-and-language-policy.md`.

### Phase 4: Repository Language Policy

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
