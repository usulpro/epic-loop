# Epic Problem Framing

## Problem

The existing epic-loop harness is implemented against Codex hook configuration,
Codex session discovery, and Codex-specific Stop payload fields. Claude Code has
the same core continuation contract for Stop hooks, but differs in hook
configuration, readiness checks, assistant report capture, and session fallback.

The product problem is to make epic-loop run on Claude Code without forking the
loop engine or changing the operating model.

## Desired Outcome

The same epic-loop lifecycle works on both Codex and Claude Code:

- Shaping, implementation, review, and reset modes keep the same behavior.
- The manager -> techlead -> engineer loop stays governed by the existing
  durable `.epic-loop/` state model.
- Stop hook continuations still use `{ "decision": "block", "reason": "..." }`.
- Codex remains the default and must not regress.
- Claude Code support is additive and lives behind thin platform-specific
  adapters.

## Scope

- Normalize hook payload handling where Codex and Claude Code differ.
- Capture Claude Code role reports from `transcript_path` JSONL instead of
  `last_assistant_message`.
- Add Claude Code hook configuration support for `.claude/settings.json` and the
  project-local hook install path.
- Add Claude Code readiness checks, especially hook settings presence and the
  Stop-hook block cap environment requirement.
- Add Claude-aware current-session lookup for `bind-session --current`, driven
  by configured platform and fresh hook capture.
- Update tests, validation, and skill docs so both platforms are explicit.

## Non-Scope

- No redesign of the epic-loop lifecycle.
- No new role model, task model, roadmap model, or artifact structure.
- No forked Claude-only implementation of the loop engine.
- No change to Codex as the primary/default target.
- No dependency on raw transcript history as the source of epic truth; durable
  `.epic-loop/` artifacts remain authoritative.

## Constraints

- Maximize shared code. Platform divergence is allowed only for payload/report
  capture, hook installer/config, doctor preconditions, and current-session
  lookup.
- Keep scripts deterministic Node.js modules.
- Do not commit runtime/debug artifacts.
- Preserve existing public CLI behavior unless a new explicit platform flag is
  introduced.
- Version-specific Claude Code facts must be confirmed against the targeted CLI
  before hard-coding behavior.

## Open Questions

- What exact Claude Code CLI version should be treated as the target for the
  initial release?
- None currently blocking implementation.

## Known Implementation Surface

- `plugins/epic-loop/skills/epic-loop/scripts/lib/common.mjs`
- `plugins/epic-loop/skills/epic-loop/scripts/lib/hooks.mjs`
- `plugins/epic-loop/skills/epic-loop/scripts/lib/loop.mjs`
- `plugins/epic-loop/skills/epic-loop/scripts/lib/epics.mjs`
- `plugins/epic-loop/skills/epic-loop/scripts/{doctor,install-hooks,bind-session,hook}.mjs`
- `plugins/epic-loop/skills/epic-loop/references/*.md`
- `plugins/epic-loop/.codex-plugin/plugin.json`
- `tests/unit/*.test.mjs`
