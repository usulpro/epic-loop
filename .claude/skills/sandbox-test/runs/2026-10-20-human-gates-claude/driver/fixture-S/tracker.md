# Tracker

Epic: Mini

## Task Statuses

- todo
- doing
- need-review
- blocked
- on-hold
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

### Phase 1: Mini

- Phase status: todo
- Intent: a release workflow for the mini package.

- [ ] Kind: implementation | Status: todo | Add the release workflow .github/workflows/release.yml that publishes with NPM_TOKEN
  - Outcome: a GitHub Actions workflow that runs `npm test` and `npm publish` with the `NPM_TOKEN` secret, triggered as decision D1 says.
  - Needs the human (fixture rule): H1 (the NPM_TOKEN secret in CI) must be done first, and nothing else in this epic is independent. Before briefing this task, the techlead files a class B stop request (needs the human's hands).
  - Acceptance: the workflow file exists and matches D1's trigger.

- [ ] Kind: verification | Status: todo | Verify Phase 1: the workflow file and the tests
  - Method: `cat .github/workflows/release.yml` and `npm test`.
  - Evidence: the trigger matches the decision log; all tests pass.
  - Cleanup: none.
