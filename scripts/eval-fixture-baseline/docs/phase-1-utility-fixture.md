# Phase 1 Utility Fixture

## Intent

Create the first half of the isolated eval mini-project under `temp/eval-fixture-project`.

The work should be small but real: a nested git repository, pure JavaScript modules, edge cases, tests, task-owned fixture commits, and a phase-level verification command.

## Fixture Git Rules

- `temp/eval-fixture-project` must be initialized as a nested git repository before utility code is added.
- Fixture task-owned commits must be made inside `temp/eval-fixture-project` or through `git -C temp/eval-fixture-project ...`.
- Do not stage or commit fixture output from the root repository.
- The root repository intentionally keeps `temp/` ignored.

## Implementation Surface

- `temp/eval-fixture-project/src/slug-tools.mjs`
- `temp/eval-fixture-project/src/scoreboard.mjs`
- `temp/eval-fixture-project/test/slug-tools.test.mjs`
- `temp/eval-fixture-project/test/scoreboard.test.mjs`
- `temp/eval-fixture-project/verification/phase-1.md`

No files outside `temp/eval-fixture-project` should be created or modified during this phase.

## Repository Setup

Initialize the fixture repository:

```bash
mkdir -p temp/eval-fixture-project
git -C temp/eval-fixture-project init
git -C temp/eval-fixture-project config user.name "Eval Fixture"
git -C temp/eval-fixture-project config user.email "eval-fixture@example.local"
```

Create a minimal `README.md`, commit it from the fixture repository, and verify:

```bash
git -C temp/eval-fixture-project add README.md
git -C temp/eval-fixture-project commit -m "Initialize eval fixture project"
git -C temp/eval-fixture-project status --short
git -C temp/eval-fixture-project log --oneline -1
```

## Expected Functions

`slug-tools.mjs` should export:

- `normalizeTitle(value)`: trims input, lowercases it, collapses whitespace, strips unsupported punctuation, and returns a readable normalized title.
- `createStableSlug(value, existing = [])`: creates a URL-safe slug from a title and appends `-2`, `-3`, etc. when the slug already exists.

`scoreboard.mjs` should export:

- `rankCandidates(candidates)`: sorts candidates by descending score, keeps stable alphabetical tie ordering by name, and returns rank numbers that share ranks for tied scores.
- `summarizeScores(candidates)`: returns count, highest score, lowest score, and average score rounded to two decimals.

## Test Expectations

Tests should use built-in `node:test` and `node:assert/strict`.

Coverage should include:

- whitespace and punctuation normalization
- duplicate slug suffixing
- score sorting
- tied ranks
- summary statistics
- invalid input behavior where reasonable

## Verification

Run:

```bash
node --test temp/eval-fixture-project/test/*.test.mjs
```

Evidence:

- command exits with code `0`
- stdout reports passing tests for both phase 1 modules
- `temp/eval-fixture-project/verification/phase-1.md` records the command and result
- `git -C temp/eval-fixture-project status --short` is clean after the verification evidence commit
- fixture commits are visible through `git -C temp/eval-fixture-project log --oneline`
