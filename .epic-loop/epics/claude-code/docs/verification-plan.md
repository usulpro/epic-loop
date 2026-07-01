# Verification Plan

## Baseline

Every implementation phase must prove that Codex behavior still works and that
the new Claude Code path works through the same public script contracts.

## Required Automated Evidence

- Unit tests for runtime platform config reading and payload normalization.
- Unit tests for Codex Stop report capture from `last_assistant_message`.
- Unit tests for Claude Code Stop report capture from transcript JSONL.
- CLI contract tests for `doctor.mjs` and `install-hooks.mjs` on both platforms.
- Hook contract tests for bound and unbound sessions on both platforms.
- Claude Code runtime-cap tests that record
  `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` at implementation start and route to manager
  before a finite cap is exhausted.
- `pnpm run validate`.
- `pnpm run test:unit`.

## Required Manual Or Runtime Evidence

When a local Claude Code CLI is available, run a sandboxed project flow:

1. Install or expose the Claude Code hook config.
2. Review/trust hooks through Claude Code's `/hooks` flow.
3. Set `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` according to the accepted release
   policy.
4. Initialize a disposable epic.
5. Bind the current session to implementation mode.
6. Confirm the first continuation enters manager housekeeping, then techlead,
   then one engineer task.
7. Inspect `.epic-loop/` artifacts for role reports and runtime state.

If Claude Code CLI is unavailable in the implementation environment, capture the
gap in `implementation-log.md` and rely on synthetic hook payload tests until a
manual verification environment is prepared.
