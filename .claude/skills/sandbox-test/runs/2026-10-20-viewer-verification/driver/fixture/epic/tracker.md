# Tracker

Epic: Mini Viewer

Next task id: T5

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

### Phase 1: Greetings

- Phase status: todo
- Intent: three tiny helpers in src/index.mjs, each with a test, to give the epic viewer a live loop to watch.

- [ ] Kind: implementation | Status: todo | T1 · Add greet(name) returning "Hello, <name>!"
  - Outcome: `greet(name)` in `src/index.mjs` returns `Hello, <name>!`, with a test in `test/index.test.mjs`.
  - Acceptance: `npm test` passes.

- [ ] Kind: implementation | Status: todo | T2 · Add farewell(name) returning "Goodbye, <name>."
  - Outcome: `farewell(name)` returns `Goodbye, <name>.`, with a test.
  - Acceptance: `npm test` passes.

- [ ] Kind: implementation | Status: todo | T3 · Add shout(text) returning the text upper-cased with "!"
  - Outcome: `shout(text)` returns `TEXT!`, with a test.
  - Acceptance: `npm test` passes.

- [ ] Kind: verification | Status: todo | T4 · Verify Phase 1: all helpers and tests
  - Method: `npm test`.
  - Evidence: all tests pass.
  - Cleanup: none.
