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

## 2026-07-01T15:11:59+00:00 - Closed. Added Claude Code project-local .claude/settings.json hook installation for SessionStart, UserPromptSubmit, and Stop using the shared hook command. Installer preserves unrelated top-level settings and hook entries, repairs stale epic-loop hook commands, supports dry-run without writing files, and remains idempotent. Existing Codex install behavior remains covered. Verification: pnpm run test:unit passed 21/21; pnpm run validate passed. Residual gaps intentionally deferred: Claude doctor readiness and CLAUDE_CODE_STOP_HOOK_BLOCK_CAP policy.

- Task: Phase 2 Task 1 - Claude Code hook installer
- Verdict: Closed. Added Claude Code project-local .claude/settings.json hook installation for SessionStart, UserPromptSubmit, and Stop using the shared hook command. Installer preserves unrelated top-level settings and hook entries, repairs stale epic-loop hook commands, supports dry-run without writing files, and remains idempotent. Existing Codex install behavior remains covered. Verification: pnpm run test:unit passed 21/21; pnpm run validate passed. Residual gaps intentionally deferred: Claude doctor readiness and CLAUDE_CODE_STOP_HOOK_BLOCK_CAP policy.

## 2026-07-01T15:19:07+00:00 - closed: implemented platform-config-driven Claude Code doctor readiness for project-local settings and stop-hook block cap policy while preserving Codex doctor compatibility. Verification rerun by techlead: pnpm run test:unit passed 22/22; pnpm run validate passed with epic-loop package validation. Residual scope intentionally deferred: current-session binding, runtime cap recording, manager cap-proximity routing, docs packaging, and manual Claude CLI smoke tests. Commit: task-owned closure commit.

- Task: Phase 2 Task 2 - Add platform-config-driven doctor readiness checks for Codex and Claude Code
- Verdict: closed: implemented platform-config-driven Claude Code doctor readiness for project-local settings and stop-hook block cap policy while preserving Codex doctor compatibility. Verification rerun by techlead: pnpm run test:unit passed 22/22; pnpm run validate passed with epic-loop package validation. Residual scope intentionally deferred: current-session binding, runtime cap recording, manager cap-proximity routing, docs packaging, and manual Claude CLI smoke tests. Commit: task-owned closure commit.

## 2026-07-01T15:23:39+00:00 - closed: verified public CLI contracts for Codex and Claude Code platform setup paths. Added one targeted assertion proving recommended finite CLAUDE_CODE_STOP_HOOK_BLOCK_CAP values greater than 50 remain ready without warnings. Evidence covers missing and invalid platform config, Codex platform selection/install/ready/idempotency, Claude platform selection, dry-run, install preservation and stale command repair, missing/stale/invalid settings, cap policy for 0/20/51/19/invalid/missing, and temp-root cleanup via test finally blocks. Verification rerun by techlead: pnpm run test:unit passed 22/22; pnpm run validate passed with epic-loop package validation. Phase 2 is closed with automated CLI contract coverage; Phase 3 Claude session binding and loop runtime work remains next.

- Task: Phase 2 Task 3 - Verify platform selection, hook installer, and doctor contracts for Codex and Claude Code temp projects
- Verdict: closed: verified public CLI contracts for Codex and Claude Code platform setup paths. Added one targeted assertion proving recommended finite CLAUDE_CODE_STOP_HOOK_BLOCK_CAP values greater than 50 remain ready without warnings. Evidence covers missing and invalid platform config, Codex platform selection/install/ready/idempotency, Claude platform selection, dry-run, install preservation and stale command repair, missing/stale/invalid settings, cap policy for 0/20/51/19/invalid/missing, and temp-root cleanup via test finally blocks. Verification rerun by techlead: pnpm run test:unit passed 22/22; pnpm run validate passed with epic-loop package validation. Phase 2 is closed with automated CLI contract coverage; Phase 3 Claude session binding and loop runtime work remains next.

## 2026-07-01T15:30:32+00:00 - closed: added Claude Code current-session detection through fresh hook capture data while preserving Codex current-session lookup and explicit session-id binding. Claude hook captures are stored under .epic-loop/.runtime/claude-code-last-hook-capture.json, bind-session --current records current-claude-code-session source for Claude captures, and stale/malformed/wrong-root captures fail with explicit --session-id guidance. Verification rerun by techlead: pnpm run test:unit passed 26/26; pnpm run validate passed with epic-loop package validation. Residual scope intentionally deferred: runtime cap recording, cap-proximity routing, docs packaging, and end-to-end implementation routing.

- Task: Phase 3 Task 1 - Add Claude-aware current-session detection for implementation binding
- Verdict: closed: added Claude Code current-session detection through fresh hook capture data while preserving Codex current-session lookup and explicit session-id binding. Claude hook captures are stored under .epic-loop/.runtime/claude-code-last-hook-capture.json, bind-session --current records current-claude-code-session source for Claude captures, and stale/malformed/wrong-root captures fail with explicit --session-id guidance. Verification rerun by techlead: pnpm run test:unit passed 26/26; pnpm run validate passed with epic-loop package validation. Residual scope intentionally deferred: runtime cap recording, cap-proximity routing, docs packaging, and end-to-end implementation routing.

## 2026-07-01T15:36:15+00:00 - closed: added Claude Code implementation loop runtime cap metadata and proximity routing while preserving Codex hook behavior. Bound Claude Stop events record CLAUDE_CODE_STOP_HOOK_BLOCK_CAP metadata, cap 0 remains uncapped, finite cap proximity routes to manager with manual-continue guidance, and Claude stop_hook_active reentry returns no extra block. Verification rerun by techlead: pnpm run test:unit passed 29/29; pnpm run validate passed with epic-loop package validation. Residual scope intentionally deferred: manual Claude CLI smoke test and docs packaging.

- Task: Phase 3 Task 2 - Exercise the manager -> techlead -> engineer loop on Claude Code hook payloads
- Verdict: closed: added Claude Code implementation loop runtime cap metadata and proximity routing while preserving Codex hook behavior. Bound Claude Stop events record CLAUDE_CODE_STOP_HOOK_BLOCK_CAP metadata, cap 0 remains uncapped, finite cap proximity routes to manager with manual-continue guidance, and Claude stop_hook_active reentry returns no extra block. Verification rerun by techlead: pnpm run test:unit passed 29/29; pnpm run validate passed with epic-loop package validation. Residual scope intentionally deferred: manual Claude CLI smoke test and docs packaging.

## 2026-07-01T15:42:21+00:00 - closed: added a public synthetic Claude Code hook-flow test that initializes a temp epic, captures a fresh Claude SessionStart payload, binds with bind-session --current, accepts bound SessionStart/UserPromptSubmit/Stop payloads, verifies manager -> techlead -> engineer routing, and captures the manager report from transcript JSONL. Existing Codex, unbound, stop_hook_active, malformed transcript, and finite block-cap proximity hook contracts remain covered. Verification: pnpm run test:unit passed 30/30; pnpm run validate passed. Residual gap: manual Claude CLI smoke remains deferred to runtime acceptance.

- Task: Phase 3 Task 3 - Verify end-to-end synthetic Claude Code implementation routing
- Verdict: closed: added a public synthetic Claude Code hook-flow test that initializes a temp epic, captures a fresh Claude SessionStart payload, binds with bind-session --current, accepts bound SessionStart/UserPromptSubmit/Stop payloads, verifies manager -> techlead -> engineer routing, and captures the manager report from transcript JSONL. Existing Codex, unbound, stop_hook_active, malformed transcript, and finite block-cap proximity hook contracts remain covered. Verification: pnpm run test:unit passed 30/30; pnpm run validate passed. Residual gap: manual Claude CLI smoke remains deferred to runtime acceptance.

## 2026-07-01T15:50:53+00:00 - closed: updated SKILL.md, hooks-and-session-routing.md, and implementation-cycle.md to describe explicit Codex/Claude Code platform selection, project-local hook setup, trust review, Claude Code block-cap policy, report capture differences, current-session binding caveats, and Stop reentry/cap-proximity behavior. Verification rerun by techlead: pnpm run validate passed with epic-loop package validation; targeted stale Codex-only setup grep returned no matches. Residual scope intentionally deferred: package validation metadata/assets and manual Claude CLI smoke tests.

- Task: Phase 4 Task 1 - Update skill and reference documentation for dual-platform operation
- Verdict: closed: updated SKILL.md, hooks-and-session-routing.md, and implementation-cycle.md to describe explicit Codex/Claude Code platform selection, project-local hook setup, trust review, Claude Code block-cap policy, report capture differences, current-session binding caveats, and Stop reentry/cap-proximity behavior. Verification rerun by techlead: pnpm run validate passed with epic-loop package validation; targeted stale Codex-only setup grep returned no matches. Residual scope intentionally deferred: package validation metadata/assets and manual Claude CLI smoke tests.

## 2026-07-01T15:55:17+00:00 - closed: updated plugin and marketplace metadata to describe project-local Codex or Claude Code hooks instead of Codex-only hook automation, added claude-code keyword, and extended package validation to require Claude Code .claude/settings.json documentation while rejecting bundled hooks/hooks.json assets and CLAUDE_PLUGIN_ROOT hook commands until bundled Claude hooks are supported. Verification rerun by techlead: pnpm run validate passed with epic-loop package validation; stale Codex-only metadata grep returned no matches; bundled Claude hook asset inspection returned no hooks/hooks.json and no CLAUDE_PLUGIN_ROOT references. pnpm run test:unit not rerun because the slice changes package metadata and package validation only, not CLI/runtime/unit contracts.

- Task: Phase 4 Task 2 - Update package validation for any Claude Code plugin hook assets
- Verdict: closed: updated plugin and marketplace metadata to describe project-local Codex or Claude Code hooks instead of Codex-only hook automation, added claude-code keyword, and extended package validation to require Claude Code .claude/settings.json documentation while rejecting bundled hooks/hooks.json assets and CLAUDE_PLUGIN_ROOT hook commands until bundled Claude hooks are supported. Verification rerun by techlead: pnpm run validate passed with epic-loop package validation; stale Codex-only metadata grep returned no matches; bundled Claude hook asset inspection returned no hooks/hooks.json and no CLAUDE_PLUGIN_ROOT references. pnpm run test:unit not rerun because the slice changes package metadata and package validation only, not CLI/runtime/unit contracts.

## 2026-07-01T15:58:09+00:00 - closed: verified final Phase 4 package, documentation, and regression suite. Evidence covers platform selection docs, Codex and Claude Code hook config docs, trust review guidance, Claude Code block-cap policy and manager communication, report capture differences, current-session binding caveats, package metadata wording, package validation guards, and existing Codex/Claude unit coverage. Verification: pnpm run validate passed with epic-loop package validation; pnpm run test:unit passed 30/30; targeted negative inspections found no stale Codex-only wording, no bundled hooks/hooks.json, and no CLAUDE_PLUGIN_ROOT references. Phase 4 is closed; manual Claude CLI smoke remains explicitly deferred to Runtime Acceptance.

- Task: Phase 4 Task 3 - Verify final package, docs, and regression suite
- Verdict: closed: verified final Phase 4 package, documentation, and regression suite. Evidence covers platform selection docs, Codex and Claude Code hook config docs, trust review guidance, Claude Code block-cap policy and manager communication, report capture differences, current-session binding caveats, package metadata wording, package validation guards, and existing Codex/Claude unit coverage. Verification: pnpm run validate passed with epic-loop package validation; pnpm run test:unit passed 30/30; targeted negative inspections found no stale Codex-only wording, no bundled hooks/hooks.json, and no CLAUDE_PLUGIN_ROOT references. Phase 4 is closed; manual Claude CLI smoke remains explicitly deferred to Runtime Acceptance.
