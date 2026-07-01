# Unit Test Plan

## Intent

Add reasonable deterministic unit coverage for the `epic-loop` engine without testing LLM behavior or prose-only document wording.

## Target Surface

- Script helper modules under `plugins/epic-loop/skills/epic-loop/scripts/lib/**`.
- CLI scripts that mutate or inspect epic state, including initialization, hook setup, doctor checks, task and phase transitions, tracker rendering, role handoff, and brief writing.
- Hook routing behavior for bound and unbound sessions.
- File-system state contracts for `.epic-loop/epics/<slug>/**` and `.epic-loop/.runtime/**`.

## Expected Test Style

- Test command: `pnpm run test:unit`.
- Harness: Node's built-in `node:test` runner with `node:assert/strict`; no test dependency is required for the current ESM-only script surface.
- Use isolated temporary project roots.
- Prefer public CLI contract tests for scripts and focused module tests for helpers.
- Assert parsed JSON, exit codes, file presence, status changes, and idempotency.
- Include edge cases that affect engine correctness, such as invalid slugs, stale hook commands, unbound sessions, missing runtime files when recovery is expected, and malformed user input where scripts should fail clearly.

## Deterministic Surface Map

- Common helpers: argument parsing, slug generation, path/root derivation, JSON read/write behavior, gitignore updates, current-session discovery fallbacks.
- Epic workspace helpers: epic initialization, listing, status output, file-system contract creation, runtime state creation, idempotent write-once behavior.
- Roadmap and tracker helpers: roadmap state creation, task and phase status changes, active task/phase updates, tracker rendering.
- Hook helpers: hook config install/update planning, stale command detection, hook event coverage, unbound-session no-op routing, bound-session routing.
- Loop helpers: implementation start state, next-role handoff, engineer brief writing, manager/engineer report summaries, interruption handling.
- CLI contracts: exit status, stdout/stderr, required flags, generated files, invalid input messages, temp-project isolation.

## Non-Goals

- Snapshotting full generated documents.
- Testing every possible missing-file absence case.
- Testing Codex or LLM behavior.
- Testing user-facing prose unless it is a documented machine-readable contract.

## Verification Evidence

The phase-level verification should record:

- exact unit test command;
- `pnpm run validate` result;
- coverage summary or explicit tested-surface list;
- confirmation that runtime/debug artifacts were not committed.
