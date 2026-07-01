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

## 2026-07-01T14:59:57+00:00 - Closed. Added explicit runtime platform config at .epic-loop/.runtime/platform.json, doctor-driven platform bootstrap for codex and claude-code, platform guards for install-hooks/hook/bind-session --current, Codex-preserving doctor behavior after codex selection, structured Claude setup-required doctor boundary, and unit coverage for missing platform errors, Codex contracts, Claude doctor boundary, and Claude-shaped unbound Stop payloads. Verification: pnpm run test:unit passed 16/16; pnpm run validate passed. Residual gaps intentionally deferred: full Claude hook installer/readiness policy and transcript report capture.

- Task: Phase 1 Task 1 - Platform adapter foundation
- Verdict: Closed. Added explicit runtime platform config at .epic-loop/.runtime/platform.json, doctor-driven platform bootstrap for codex and claude-code, platform guards for install-hooks/hook/bind-session --current, Codex-preserving doctor behavior after codex selection, structured Claude setup-required doctor boundary, and unit coverage for missing platform errors, Codex contracts, Claude doctor boundary, and Claude-shaped unbound Stop payloads. Verification: pnpm run test:unit passed 16/16; pnpm run validate passed. Residual gaps intentionally deferred: full Claude hook installer/readiness policy and transcript report capture.

## 2026-07-01T15:04:35+00:00 - Closed. Added platform-aware assistant report extraction in loop.mjs: Codex continues to use last_assistant_message, while Claude Code reads transcript_path JSONL and appends the latest assistant text to the existing manager/engineer report files. Missing, unreadable, malformed, or assistant-empty transcripts fail softly and do not break Stop continuation routing. Verification: pnpm run test:unit passed 19/19; pnpm run validate passed. Residual gaps intentionally deferred: Claude hook installer/readiness policy, Claude current-session binding, and block-cap handling.

- Task: Phase 1 Task 2 - Claude transcript report capture
- Verdict: Closed. Added platform-aware assistant report extraction in loop.mjs: Codex continues to use last_assistant_message, while Claude Code reads transcript_path JSONL and appends the latest assistant text to the existing manager/engineer report files. Missing, unreadable, malformed, or assistant-empty transcripts fail softly and do not break Stop continuation routing. Verification: pnpm run test:unit passed 19/19; pnpm run validate passed. Residual gaps intentionally deferred: Claude hook installer/readiness policy, Claude current-session binding, and block-cap handling.

## 2026-07-01T15:07:28+00:00 - Closed. Verified Phase 1 adapter compatibility across Codex and Claude Code payload fixtures. Evidence covers Codex last_assistant_message report capture, Claude transcript_path report capture, missing Claude optional fields, malformed/missing/assistant-empty transcript soft failure, unbound Codex and Claude sessions, bound Stop continuation, and explicit missing/invalid platform config failures. Verification: pnpm run test:unit passed 20/20; pnpm run validate passed. Phase 1 is closed with automated synthetic coverage; manual Claude CLI runtime smoke remains deferred to Phase 5.

- Task: Phase 1 Task 3 - Platform adapter compatibility verification
- Verdict: Closed. Verified Phase 1 adapter compatibility across Codex and Claude Code payload fixtures. Evidence covers Codex last_assistant_message report capture, Claude transcript_path report capture, missing Claude optional fields, malformed/missing/assistant-empty transcript soft failure, unbound Codex and Claude sessions, bound Stop continuation, and explicit missing/invalid platform config failures. Verification: pnpm run test:unit passed 20/20; pnpm run validate passed. Phase 1 is closed with automated synthetic coverage; manual Claude CLI runtime smoke remains deferred to Phase 5.
