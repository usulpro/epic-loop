# Phase 2 Report Builder

## Intent

Extend the isolated fixture with a small integration module that composes phase 1 utilities, verify the full mini-project, and leave the completed folder available for inspection.

## Implementation Surface

- `temp/eval-fixture-project/src/report-builder.mjs`
- `temp/eval-fixture-project/test/report-builder.test.mjs`
- existing phase 1 fixture files under `temp/eval-fixture-project`

No production plugin files should be changed.

## Expected Functions

`report-builder.mjs` should export:

- `buildCandidateReport(input)`: accepts a report title and candidate list, builds a stable report slug, ranked candidates, and score summary.
- `formatCandidateReport(report)`: returns deterministic plain text with the normalized title, slug, ranked candidate lines, and summary line.

The implementation should reuse `slug-tools.mjs` and `scoreboard.mjs` instead of duplicating their logic.

## Test Expectations

Tests should use built-in `node:test` and `node:assert/strict`.

Coverage should include:

- composed report slug generation
- ranking output from the phase 1 scoreboard helper
- formatted plain-text output
- behavior for an empty candidate list or invalid candidate payload

## Combined Verification

Run:

```bash
node --test temp/eval-fixture-project/test/*.test.mjs
node -e "import('./temp/eval-fixture-project/src/report-builder.mjs').then(({ buildCandidateReport, formatCandidateReport }) => { const report = buildCandidateReport({ title: 'July Eval Round', candidates: [{ name: 'Ada', score: 9 }, { name: 'Linus', score: 8 }] }); console.log(formatCandidateReport(report)); })"
```

Evidence:

- test command exits with code `0`
- one-off import command exits with code `0`
- stdout includes the report slug and ranked candidate lines
- `temp/eval-fixture-project` remains present after verification
