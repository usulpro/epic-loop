# Tracker

Epic: Eval Fixture Epic For Testing Epic-loop Role Routing

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

### Phase 1: Build Isolated Utility Fixture

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Create string normalization utilities with tests.
  - Outcome: `temp/eval-fixture-project` contains tested slug/title helpers that handle normalization and duplicate slug generation.
  - Surface: `temp/eval-fixture-project/src/slug-tools.mjs`, `temp/eval-fixture-project/test/slug-tools.test.mjs`.
  - Acceptance: `normalizeTitle` and `createStableSlug` are exported, covered by `node:test`, and handle whitespace, punctuation, and duplicate slug suffixes.
  - Docs: `docs/problem-framing.md`, `docs/phase-1-utility-fixture.md`.

- [ ] Kind: implementation | Status: todo | Create candidate scoring utilities with tests.
  - Outcome: `temp/eval-fixture-project` contains tested score helpers for ranking candidates and summarizing score distributions.
  - Surface: `temp/eval-fixture-project/src/scoreboard.mjs`, `temp/eval-fixture-project/test/scoreboard.test.mjs`.
  - Acceptance: `rankCandidates` and `summarizeScores` are exported, covered by `node:test`, and handle sorting, tied ranks, averages, and invalid input behavior.
  - Docs: `docs/problem-framing.md`, `docs/phase-1-utility-fixture.md`.

- [ ] Kind: verification | Status: todo | Verify phase 1 utility fixture through Node test runner.
  - Outcome: Phase 1 utility modules are proven through real test execution before integration work starts.
  - Surface: `temp/eval-fixture-project/src/**`, `temp/eval-fixture-project/test/**`, Node.js test runner output.
  - Acceptance: Run `node --test temp/eval-fixture-project/test/*.test.mjs`; expected evidence is exit code `0`, passing tests for slug and scoreboard modules, and no changed files outside `temp/eval-fixture-project` except epic artifacts.
  - Docs: `docs/phase-1-utility-fixture.md`.

### Phase 2: Integrate Report Builder Fixture

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Create report builder integration module with tests.
  - Outcome: `temp/eval-fixture-project` contains an integration module that composes phase 1 helpers into deterministic candidate reports.
  - Surface: `temp/eval-fixture-project/src/report-builder.mjs`, `temp/eval-fixture-project/test/report-builder.test.mjs`, existing phase 1 modules.
  - Acceptance: `buildCandidateReport` and `formatCandidateReport` are exported, covered by `node:test`, reuse phase 1 helpers, and handle normal and empty or invalid input cases.
  - Docs: `docs/problem-framing.md`, `docs/phase-2-report-builder.md`.

- [ ] Kind: verification | Status: todo | Verify combined mini-project behavior.
  - Outcome: The complete `temp/eval-fixture-project` mini-project is proven through tests and a direct runtime import.
  - Surface: `temp/eval-fixture-project/src/**`, `temp/eval-fixture-project/test/**`, Node.js test runner output, one-off Node import output.
  - Acceptance: Run `node --test temp/eval-fixture-project/test/*.test.mjs` and the documented `node -e` import command; expected evidence is exit code `0`, passing tests, stdout containing the formatted report slug and ranked candidates, and the fixture folder still present after verification.
  - Docs: `docs/phase-2-report-builder.md`.
