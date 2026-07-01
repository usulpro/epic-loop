# Decision Log

## Active Decisions

### 2026-07-01 - Preserve The Codex Harness Behavior

Decision: Claude Code support must reproduce the existing Codex epic-loop
behavior, lifecycle, role routing, and artifact model.

Motivation: The epic intent explicitly asks for the same loop on a different
technical platform, not a redesign.

Rejected alternatives: A separate Claude-only loop engine, new role protocol, or
new artifact layout.

Status: active.

### 2026-07-01 - Keep The Loop Engine Platform-Neutral

Decision: Shared loop behavior remains in the existing scripts/libs, with
platform-specific adapters only for hook config, doctor checks, report capture,
and current-session lookup.

Motivation: This keeps the implementation maximally DRY and reduces drift
between Codex and Claude Code.

Rejected alternatives: Copying `loop.mjs` or maintaining parallel platform
script trees.

Status: active.

### 2026-07-01 - Claude Reports Come From Transcript JSONL

Decision: Claude Code Stop report capture must parse `transcript_path` JSONL to
obtain the latest assistant message because Claude Code does not provide
`last_assistant_message`.

Motivation: Report capture is the only materially different Stop payload shape
needed by the current loop.

Status: active.

### 2026-07-01 - Claude Doctor Replaces The Codex Feature-Flag Check

Decision: Claude Code readiness checks should not look for Codex `[features]
hooks = true`. They should verify Claude hook settings and the Stop-hook block
cap requirement.

Motivation: Claude Code has hook trust/review behavior rather than a pollable
Codex-style feature flag.

Status: active.

### 2026-07-01 - Platform Is Selected Once Through Doctor Runtime Config

Decision: Platform selection uses the first doctor call:
`doctor.mjs --platform codex --json` or `doctor.mjs --platform claude-code
--json`. Doctor writes the selected value into uncommitted project runtime
state, such as `.epic-loop/.runtime/platform.json`.

Motivation: Doctor is already the first required skill command. Passing
`--platform` there avoids a separate bootstrap script and keeps the rest of the
lifecycle commands clean.

Rejected alternatives: Per-command `--platform` on every boundary script,
separate `set-platform.mjs`, payload-shape autodetection, cwd-based inference,
config-file-presence inference, and environment-variable fallback.

Tradeoff: One checkout has one active platform at a time. Parallel Codex and
Claude Code runtime testing should use separate checkouts or sandboxes.

Status: active.

### 2026-07-01 - Claude Hooks Install Into Project Settings

Decision: The initial Claude Code hook installer writes project-local
`.claude/settings.json`.

Motivation: Project-local settings match the existing project-local Codex hook
setup model and keep the supported install path explicit.

Rejected alternatives: `.claude/settings.local.json`, user-level Claude
settings, managed settings, and bundled plugin hook assets for the first
implementation slice.

Status: active.

### 2026-07-01 - Claude Stop-Hook Block Cap Policy

Decision: Claude doctor accepts `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0` or any
integer value `>=20`. It recommends `0` or values greater than `50`. Values from
`20` through `50` are accepted with an explicit warning that the loop engine may
stop early at that many consecutive Stop-hook continuations, after which the
user must manually ask the agent to continue loop mode. Missing, invalid, or
values below `20` are setup-required.

Motivation: `0` is the best long-run setting, but finite caps can be acceptable
when the user wants a safety rail. Values below `20` are too likely to interrupt
normal autonomous loop progress.

Status: active.

### 2026-07-01 - Manager Communicates Claude Block-Cap Stops

Decision: When Claude Code implementation starts, the effective
`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` value is recorded in runtime state. If a
finite cap is close to being reached, the loop hands off to manager housekeeping
before the platform forcibly stops the run. The manager communicates the stop to
the user and explains that they can manually ask the agent to continue loop mode.

Motivation: Platform-enforced hook caps are operational concerns. The manager
role owns user-facing lifecycle communication, so cap-related pauses should be
handled through manager housekeeping rather than by a low-level hook failure.

Status: active.

## Open Design Questions

- Target Claude Code CLI version for hard-coded assumptions.
- Exact file shape for `.epic-loop/.runtime/platform.json`.

## Historical Decisions

- None recorded yet.
