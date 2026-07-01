# State Of Epic

Epic: Claude Code Harness
Slug: `claude-code`
Created: 2026-07-01T11:21:58+00:00
Current mode: implementation
Active phase: Phase 2 - Claude Hook Setup And Doctor
Active task: TBD

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

## Blockers

- No implementation blocker recorded.

## Next Action

- Start Phase 2 Task 3: verify platform selection, hook installer, and doctor
  contracts for Codex and Claude Code temp projects.
