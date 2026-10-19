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
- Intent: a greeting module and its release note, with the human's choices collected on review pages.

- [ ] Kind: implementation | Status: todo | Add greet(name) to src/index.mjs with the punctuation the human picks (H1)
  - Outcome: `greet(name)` returns `Hello, <name>` followed by the punctuation chosen in H1, with a test.
  - Review page protocol (fixture rule): before briefing this task, the techlead asks the manager for housekeeping with the reason "open the non-blocking review page for H1". The manager has the page builder build a level-2 decision page for H1 (one choice named `h1`, options `!` and `.`, recommended `!`, no second language), passes `review check`, and opens a non-blocking gate covering H1. The techlead then briefs this task with the default `!`; if the answer differs, it plans the change after the ingest.
  - Acceptance: `npm test` passes.

- [ ] Kind: implementation | Status: todo | Write RELEASE.md with the release name the human confirms (H2)
  - Outcome: `RELEASE.md` names the confirmed release.
  - Review page protocol (fixture rule): this task needs the human. Before briefing it, the techlead asks the manager for housekeeping with the reason "open the blocking review page for H2 and H3". The manager has the page builder build one page: a card for H2 with a "done" check named `h2` (confirm the release name 'Mini 1.0'), and a card for H3 (a security-hold) with an explicit confirmation check named `h3` ("I allow npm publish"). No second language. It passes `review check` and opens a blocking gate covering H2 and H3, then ends its turn: the loop waits for the human.
  - Acceptance: `RELEASE.md` exists after H2 is resolved.

- [ ] Kind: verification | Status: todo | Verify Phase 1: tests pass, greet output, RELEASE.md
  - Method: `npm test` and `cat RELEASE.md`.
  - Evidence: all tests pass; the release note names the release.
  - Cleanup: none.
