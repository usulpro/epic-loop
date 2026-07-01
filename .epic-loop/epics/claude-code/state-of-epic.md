# State Of Epic

Epic: Claude Code Harness
Slug: `claude-code`
Created: 2026-07-01T11:21:58+00:00
Current mode: shaping
Active phase: Phase 1 - Platform Adapter Foundation
Active task: TBD

## Current State

- Shaping captured the Claude Code harness intent and adapter boundaries.
- The roadmap is decomposed into implementation phases with verification tasks.
- The implementation plan preserves Codex behavior as the default path and adds
  Claude Code support through thin platform-specific surfaces.

## Blockers

- No implementation blocker recorded.
- Before hard-coding Claude Code readiness behavior, confirm the targeted Claude
  Code CLI version and `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` policy.

## Next Action

- Start implementation only after explicit user confirmation in the current
  session.
