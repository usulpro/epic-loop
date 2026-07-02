# Phase 1 Utility Fixture

## Intent

Create the first half of the isolated eval mini-project under `temp/eval-fixture-project`.

The work should be small but real: pure JavaScript modules, edge cases, tests, and a phase-level verification command.

## Implementation Surface

- `temp/eval-fixture-project/src/slug-tools.mjs`
- `temp/eval-fixture-project/src/scoreboard.mjs`
- `temp/eval-fixture-project/test/slug-tools.test.mjs`
- `temp/eval-fixture-project/test/scoreboard.test.mjs`

No files outside `temp/eval-fixture-project` should be created or modified during this phase.

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
- repository diff shows implementation files only under `temp/eval-fixture-project`
