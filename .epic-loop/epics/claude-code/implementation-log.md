# Implementation Log

## 2026-07-01T11:21:58+00:00 - Epic Workspace Initialized

- Created epic workspace for `claude-code`.
- Initial mode: shaping.

## 2026-07-01T11:22:30+00:00 - Shaping Roadmap Added

- Captured the Claude Code port intent, non-goals, adapter boundaries, active
  decisions, risks, and verification expectations.
- Added implementation phases and tasks for the Claude Code harness port.

## 2026-07-01T12:58:06+00:00 - Platform Selection Contract Refined

- Accepted a single explicit platform setup point:
  `set-platform.mjs --platform codex|claude-code`.
- Platform-aware scripts must read uncommitted runtime platform config and must
  not use fallbacks or autodetection.
- Recorded the one-platform-per-checkout limitation and updated roadmap tasks.

## 2026-07-01T13:10:30+00:00 - Platform Bootstrap Moved Into Doctor

- Replaced the separate `set-platform.mjs` idea with doctor-driven bootstrap:
  `doctor.mjs --platform codex|claude-code --json`.
- Doctor writes `.epic-loop/.runtime/platform.json`; later platform-aware
  scripts read it and do not accept autodetection or fallbacks.
- Confirmed the current hook gate ignores unbound sessions before entering the
  implementation engine.

## 2026-07-01T13:50:00+00:00 - Claude Hook And Block-Cap Policy Set

- Claude Code hooks install into project-local `.claude/settings.json`.
- Claude doctor accepts `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0` or `>=20`.
- Doctor recommends `0` or values greater than `50`.
- Doctor warns for values from `20` through `50` that loop mode may stop early at
  that many consecutive Stop-hook continuations and the user may need to
  manually ask the agent to continue loop mode.

## 2026-07-01T14:01:58+00:00 - Claude Runtime Cap Communication Guard Added

- Claude implementation start must record the effective
  `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` value in runtime state.
- If a finite cap is close to exhaustion, the loop must hand off to manager
  housekeeping before the platform forcibly stops the run.
- Manager owns the user-facing communication: explain that the loop is stopping
  near `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` and tell the user to manually ask the
  agent to continue loop mode.
