# Platform Adapter Contract

## Intent

Claude Code support must reuse the existing epic-loop engine. The adapter layer
exists only to translate platform-specific hook setup, payload/report capture,
doctor checks, and current-session lookup into the existing core contracts.

## Platform Selection

The platform is selected once through the first doctor call and stored in
uncommitted runtime state:

```bash
node <skill-dir>/scripts/doctor.mjs --platform codex --json
node <skill-dir>/scripts/doctor.mjs --platform claude-code --json
```

Doctor is already the first required skill command, so it owns bootstrap. When
`--platform` is provided, doctor writes project-local runtime config, for
example:

```text
.epic-loop/.runtime/platform.json
```

Supported values are exactly:

- `codex`
- `claude-code`

There is no platform autodetection and no fallback. Any platform-aware script
that needs the selected platform must read this runtime config before doing
platform-specific work. If the config is missing or invalid, it must fail with a
clear error that includes the exact fix command.

Platform selection is a project-checkout runtime setting, not a committed epic
artifact. Switching platforms in the same checkout requires running
`doctor.mjs --platform <platform>` again and then re-running the relevant hook
setup for the new platform.

## Shared Core That Must Stay Shared

- Epic workspace layout under `.epic-loop/`.
- Runtime state and session binding files.
- Role rotation and implementation loop decisions.
- Engineer brief writing and next-role state.
- Tracker, implementation log, decision log, and risk register behavior.
- Stop continuation shape: `{ "decision": "block", "reason": "<prompt>" }`.

## Platform-Specific Surfaces

### Report Capture

Codex provides `last_assistant_message` directly in the Stop payload. Claude Code
does not. The Claude adapter must read `transcript_path`, parse the JSONL
transcript, find the latest assistant-role text entry, and return that text to
the existing role-report append path.

### Hook Configuration

Codex uses `.codex/hooks.json`. Claude Code uses `.claude/settings.json`,
`.claude/settings.local.json`, user settings, managed settings, or bundled
plugin hooks. The implementation should expose this as platform-specific hook
config generation while preserving unrelated user hook entries.

For the initial Claude Code implementation, the supported install target is
project-local:

```text
.claude/settings.json
```

The installer must preserve unrelated Claude Code settings and hook entries in
that file.

### Doctor Preconditions

Codex doctor checks the Codex hooks feature flag and `.codex/hooks.json`.
Claude Code has no equivalent feature flag. Claude doctor checks should instead
verify hook config discoverability and the Stop-hook block cap requirement.

Claude Code Stop-hook block cap policy:

- `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0` is accepted and recommended for long loop
  runs because it disables the cap.
- Values greater than `50` are accepted and recommended when a finite cap is
  preferred.
- Values from `20` through `50` are accepted with an explicit warning: the loop
  engine may stop early when it reaches that number of consecutive Stop-hook
  continuations, and the user will need to manually ask the agent to continue
  loop mode.
- Missing, invalid, or values below `20` are setup-required.

When Claude Code implementation starts, the active
`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` value must be recorded in epic runtime state.
The loop must treat that recorded value as the run's effective cap metadata.

If the loop sees that a finite cap is close to being reached, it must hand off to
manager housekeeping before the platform forcibly stops the run. The manager is
responsible for user communication in this situation. The manager should explain
that the loop is stopping because it is close to
`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`, and tell the user to manually ask the agent to
continue loop mode when they want the run to proceed.

### Current Session Lookup

Codex can fall back to `.codex/tmp/last-hook-capture.json` and Codex session
metadata in the existing implementation. For this port, platform-aware current
session lookup should be strict:

- read the configured platform
- inspect only the capture source for that platform
- require the capture to be fresh and unambiguous
- fail with an explicit `--session-id` instruction when current session cannot
  be identified safely

Claude Code current-session lookup should use fresh hook-capture data containing
`session_id` and `transcript_path`. It must not infer platform from transcript
paths or payload shape.

## Compatibility Rules

- Existing Codex commands remain valid without extra flags.
- New platform selection must be explicit through runtime platform config.
- Hook payload shape must not be used to infer platform.
- Cwd, transcript path, config file presence, or environment variables must not
  be used as fallbacks for platform selection.
- Unbound sessions remain silent no-ops.
- Missing Claude-only fields must not crash Codex flows.
- Missing Codex-only fields must not crash Claude flows.
- Platform-aware scripts fail transparently when runtime platform config is
  missing or invalid.

## Platform-Aware Scripts

These scripts must read the runtime platform config:

- `doctor.mjs`
- `install-hooks.mjs`
- `hook.mjs`
- `bind-session.mjs` when `--current` is used

These scripts should remain platform-agnostic because they operate only on
`.epic-loop/` artifacts:

- roadmap/task status scripts
- implementation log scripts
- engineer brief scripts
- role summary scripts
- epic listing/status/rendering scripts

## Known Limitation

A single checkout has one active runtime platform config. Running Codex and
Claude Code against the same checkout at the same time can cause platform
confusion if one session changes the config while another session is active.
The supported initial model is one platform per checkout at a time, with
separate checkouts/sandboxes for parallel cross-platform runtime testing.
