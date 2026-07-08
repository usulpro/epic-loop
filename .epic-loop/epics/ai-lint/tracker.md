# Tracker

Epic: Focused AI Skill Review Checks

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

### Phase 1: Fixed Semantic Check Contract

- Phase status: todo

- [x] Kind: documentation-only | Status: done | Define the fixed semantic AI lint contract.
  - Outcome: The AI review command has an explicit check catalog and severity policy before implementation changes begin.
  - Surface: `.epic-loop/epics/ai-lint/docs/semantic-lint-contract.md`, `.epic-loop/epics/ai-lint/decision-log.md`.
  - Acceptance: The doc names the initial check ids, target files, pass/fail criteria, evidence requirements, and non-goals.
  - Docs: `docs/semantic-lint-contract.md`, `docs/problem-framing.md`.

- [ ] Kind: verification | Status: todo | Review the check catalog against the maintainer discussion.
  - Outcome: The first implementation slice is grounded in the desired lint-like behavior, not broad review behavior.
  - Surface: `docs/semantic-lint-contract.md`.
  - Acceptance: The catalog explicitly excludes general code review, model-created finding codes, and installed-skill runtime dependency.
  - Docs: `docs/semantic-lint-contract.md`.

### Phase 2: Runner And Schema Refactor

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Refactor `review:skills:ai` to evaluate fixed semantic checks.
  - Outcome: The runner prompt and report schema use repository-owned check ids instead of free-form model findings.
  - Surface: `scripts/review-skills-ai.mjs`, `tests/unit/skill-review-ai.test.mjs`.
  - Acceptance: Mocked valid, failing, malformed, and missing-output paths still behave deterministically; the model cannot invent blocking codes outside the fixed catalog.
  - Docs: `docs/semantic-lint-contract.md`.

- [ ] Kind: implementation | Status: todo | Add focused tests for fixed-check parsing, severity policy, and stable diagnostics.
  - Outcome: The AI boundary is protected by deterministic unit tests without invoking live Codex.
  - Surface: `tests/unit/skill-review-ai.test.mjs`, optional small helper modules under `scripts/`.
  - Acceptance: Tests prove pass, warning, blocking, unknown-check, and malformed-report behavior.
  - Docs: `docs/semantic-lint-contract.md`.

- [ ] Kind: verification | Status: todo | Verify deterministic validation remains separate from AI review.
  - Outcome: The aggregate validation path remains stable and non-AI-backed.
  - Surface: `package.json`, `scripts/review-skills-ai.mjs`, `.validation-output/skill-review/`.
  - Acceptance: `pnpm run validate` passes and does not invoke `review:skills:ai`; generated AI reports remain ignored.
  - Docs: `docs/problem-framing.md`.

### Phase 3: Live Stability Verification

- Phase status: todo

- [ ] Kind: verification | Status: todo | Run repeated live AI review checks and compare normalized results.
  - Outcome: Maintainers understand whether the fixed-check boundary reduces model jitter enough for the intended workflow.
  - Surface: `pnpm run review:skills:ai`, `.validation-output/skill-review/latest.json`.
  - Acceptance: At least three sequential live runs are compared by check id, status, severity, and evidence; any remaining jitter is recorded as a risk or follow-up.
  - Docs: `docs/semantic-lint-contract.md`, `risk-register.md`.
