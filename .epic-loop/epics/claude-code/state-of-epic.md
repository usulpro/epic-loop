# State Of Epic

Epic: Claude Code Harness
Slug: `claude-code`
Created: 2026-07-01T11:21:58+00:00
Current mode: implementation
Active phase: Phase 5 - Runtime Acceptance
Active task: Phase 5 Task 2 - Perform final Codex regression smoke test after Claude Code changes

## Current State

- Shaping captured the Claude Code harness intent and adapter boundaries.
- The roadmap is decomposed into implementation phases with verification tasks.
- The implementation plan preserves Codex behavior as the default path and adds
  Claude Code support through thin platform-specific surfaces.
- Phase 1 Task 1 is closed with explicit runtime platform selection and the
  first platform adapter boundary in place.
- Phase 1 Task 2 is closed with Claude Code transcript JSONL report capture
  feeding the existing manager/engineer report path.
- Phase 1 Task 3 is closed with automated Codex and Claude Code payload fixture
  verification passing.
- Phase 1 is closed.
- Phase 2 Task 1 is closed with Claude Code project-local hook installation for
  `.claude/settings.json`.
- Phase 2 Task 2 is closed with platform-config-driven doctor readiness checks
  for Codex and Claude Code, including Claude hook config and stop hook block
  cap status.
- Phase 2 Task 3 is closed with public CLI contract verification for Codex and
  Claude Code platform setup paths.
- Phase 2 is closed.
- Phase 3 Task 1 is closed with Claude-aware current-session detection for
  implementation binding.
- Phase 3 Task 2 is closed with Claude Code implementation loop runtime cap
  metadata and cap-proximity manager routing.
- Phase 3 Task 3 is closed with end-to-end synthetic Claude Code implementation
  routing verified through public hook and CLI contracts.
- Phase 3 is closed.
- Phase 4 Task 1 is closed with dual-platform user-facing skill and reference
  documentation updated for Codex and Claude Code operation.
- Phase 4 Task 2 is closed with package metadata and validation updated for
  dual-platform hook support without bundled Claude hook assets.
- Phase 4 Task 3 is closed with final package, docs, and regression suite
  verification passing.
- Phase 4 is closed.
- Phase 5 Task 1 is closed with real Claude Code runtime acceptance verified
  through manager, techlead, engineer execution, and engineer report capture
  after the explicit hook root correction.

## Blockers

- No implementation blocker recorded.

## Next Action

- Engineer performs the final Codex regression smoke test after the Claude Code
  changes.
