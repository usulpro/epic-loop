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

- [ ] Kind: implementation | Status: todo | Initialize nested git fixture project.
  - Outcome: `temp/eval-fixture-project` is a nested git repository with local commit identity configured and an initial task-owned commit.
  - Surface: `temp/eval-fixture-project/.git`, `temp/eval-fixture-project/README.md`.
  - Acceptance: Run `git -C temp/eval-fixture-project init`, configure local `user.name` and `user.email`, commit `README.md` from inside the fixture repository, and verify `git -C temp/eval-fixture-project status --short` is clean. Fixture task-owned commits must be created only from inside `temp/eval-fixture-project` or with `git -C temp/eval-fixture-project ...`; do not stage or commit fixture output from the root repository.
  - Docs: `docs/problem-framing.md`, `docs/phase-1-utility-fixture.md`.

- [ ] Kind: implementation | Status: todo | Create string normalization utilities with tests.
  - Outcome: `temp/eval-fixture-project` contains tested slug/title helpers that handle normalization and duplicate slug generation.
  - Surface: `temp/eval-fixture-project/src/slug-tools.mjs`, `temp/eval-fixture-project/test/slug-tools.test.mjs`.
  - Acceptance: `normalizeTitle` and `createStableSlug` are exported, covered by `node:test`, and handle whitespace, punctuation, and duplicate slug suffixes. Commit this task from inside `temp/eval-fixture-project` or with `git -C temp/eval-fixture-project ...`; do not stage or commit fixture output from the root repository.
  - Docs: `docs/problem-framing.md`, `docs/phase-1-utility-fixture.md`.

- [ ] Kind: implementation | Status: todo | Create candidate scoring utilities with tests.
  - Outcome: `temp/eval-fixture-project` contains tested score helpers for ranking candidates and summarizing score distributions.
  - Surface: `temp/eval-fixture-project/src/scoreboard.mjs`, `temp/eval-fixture-project/test/scoreboard.test.mjs`.
  - Acceptance: `rankCandidates` and `summarizeScores` are exported, covered by `node:test`, and handle sorting, tied ranks, averages, and invalid input behavior. Commit this task from inside `temp/eval-fixture-project` or with `git -C temp/eval-fixture-project ...`; do not stage or commit fixture output from the root repository.
  - Docs: `docs/problem-framing.md`, `docs/phase-1-utility-fixture.md`.

- [ ] Kind: verification | Status: todo | Verify phase 1 utility fixture through Node test runner.
  - Outcome: Phase 1 utility modules are proven through real test execution before integration work starts.
  - Surface: `temp/eval-fixture-project/src/**`, `temp/eval-fixture-project/test/**`, `temp/eval-fixture-project/verification/phase-1.md`, Node.js test runner output.
  - Acceptance: Run `node --test temp/eval-fixture-project/test/*.test.mjs`; record command evidence in `temp/eval-fixture-project/verification/phase-1.md`; commit the evidence from inside `temp/eval-fixture-project` or with `git -C temp/eval-fixture-project ...`; expected evidence is exit code `0`, passing tests, clean `git -C temp/eval-fixture-project status --short`, and no root repository commit for fixture output.
  - Docs: `docs/phase-1-utility-fixture.md`.

### Phase 2: Integrate Report Builder Fixture

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Create report builder integration module with tests.
  - Outcome: `temp/eval-fixture-project` contains an integration module that composes phase 1 helpers into deterministic candidate reports.
  - Surface: `temp/eval-fixture-project/src/report-builder.mjs`, `temp/eval-fixture-project/test/report-builder.test.mjs`, existing phase 1 modules.
  - Acceptance: `buildCandidateReport` and `formatCandidateReport` are exported, covered by `node:test`, reuse phase 1 helpers, and handle normal and empty or invalid input cases. Commit this task from inside `temp/eval-fixture-project` or with `git -C temp/eval-fixture-project ...`; do not stage or commit fixture output from the root repository.
  - Docs: `docs/problem-framing.md`, `docs/phase-2-report-builder.md`.

- [ ] Kind: verification | Status: todo | Verify combined mini-project behavior.
  - Outcome: The complete `temp/eval-fixture-project` mini-project is proven through tests and a direct runtime import.
  - Surface: `temp/eval-fixture-project/src/**`, `temp/eval-fixture-project/test/**`, `temp/eval-fixture-project/verification/phase-2.md`, Node.js test runner output, one-off Node import output.
  - Acceptance: Run `node --test temp/eval-fixture-project/test/*.test.mjs` and the documented `node -e` import command; record command evidence in `temp/eval-fixture-project/verification/phase-2.md`; commit the evidence from inside `temp/eval-fixture-project` or with `git -C temp/eval-fixture-project ...`; expected evidence is exit code `0`, passing tests, stdout containing the formatted report slug and ranked candidates, clean nested repo status, and the fixture folder still present after verification.
  - Docs: `docs/phase-2-report-builder.md`.

