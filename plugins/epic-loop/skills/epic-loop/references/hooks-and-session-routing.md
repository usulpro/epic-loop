# Hooks And Session Routing

## Contents

- [Goal](#goal)
- [Local Config](#local-config)
- [Installer Behavior](#installer-behavior)
- [Hook Payload](#hook-payload)
- [Project-Local State](#project-local-state)
- [Binding Sessions](#binding-sessions)
- [What Hooks Can And Cannot Do](#what-hooks-can-and-cannot-do)
- [Parallel Safety](#parallel-safety)

## Goal

Epic-loop hooks must be project-local and session-aware. Parallel sessions in the same project must never route events only by cwd or epic slug.

## Local Config

Start by selecting the runtime platform explicitly. `--platform` is mandatory on every `doctor` run:

```bash
node <skill-dir>/scripts/doctor.mjs --platform codex --json
node <skill-dir>/scripts/doctor.mjs --platform claude-code --json
```

This writes the selected platform to `.epic-loop/.runtime/platform.json`. Platform-aware scripts read that runtime config; they must not infer the platform from hook payload shape, cwd, environment variables, `.codex/`, `.claude/`, transcript paths, or stale runtime config when running `doctor`.

Do not run `doctor.mjs --json` without `--platform`; missing `--platform` must fail instead of falling back to a saved platform.

If setup is needed, preview the changes:

```bash
node <skill-dir>/scripts/install-hooks.mjs --dry-run
```

Install hooks from the project root only after user approval:

```bash
node <skill-dir>/scripts/install-hooks.mjs
```

This creates or updates:

```text
Codex:      .codex/hooks.json
Claude Code: .claude/settings.json
```

The hook command points to the installed skill script and handles:

- `SessionStart`
- `UserPromptSubmit`
- `Stop`

The Codex feature flag `hooks = true` must still be enabled under `[features]` in the active Codex config/profile. Older configs may use `codex_hooks = true`; `doctor` accepts both names. The project-local hook config controls which hook command runs for this project.

Current public Codex behavior requires non-managed command hooks to be reviewed and trusted before they run. Use `/hooks` in the active Codex UI/CLI to inspect, trust, or disable hooks. A static readiness check cannot prove hook trust for the current already-running thread.

Claude Code has no Codex-style hooks feature flag. Its readiness checks verify project-local `.claude/settings.json` hook entries and `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`.

Claude Code block-cap policy:

- `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0` is accepted and recommended for long loop runs.
- Integer values greater than `50` are accepted and recommended when a finite cap is preferred.
- Integer values from `20` through `50` are accepted with a warning that loop mode may stop early and require manual continuation.
- Missing, invalid, or values below `20` are setup-required.

Claude Code hooks should also be reviewed and trusted through `/hooks` before relying on continuation in an active session.

If the selected platform's project-local hook config is not writable from the current session, do not attempt workarounds. Give the user the install command and ask them to run it from a writable project checkout or host terminal.

If Codex hooks are not enabled, tell the user where the feature appears to be missing. Do not edit global `~/.codex/config.toml` from a project skill. Project-local config may be edited only after explicit user approval and only when it is writable.

Do not edit global Claude Code settings from this skill. The supported Claude Code install target is project-local `.claude/settings.json`; do not imply bundled plugin hooks or global/user settings edits are supported by the installer.

User-facing setup messages should be tiny. Normal flow is:

```text
Checking setup.
Hooks need to be added. Install now?
Hooks are configured. We can start the epic.
```

Do not show full `doctor` output by default. Do not mention `ready: true`, config paths, global config, event lists, or other diagnostics unless the user asks. If install was attempted and failed, say that explicitly in one sentence.

## Installer Behavior

The installer must be conservative:

- preserve unrelated hook entries and unrelated Claude Code settings
- add missing epic-loop hook entries for `SessionStart`, `UserPromptSubmit`, and `Stop`
- replace stale epic-loop hook commands when the skill path changed
- refuse to overwrite invalid JSON
- support `--dry-run` without writing files
- keep mutable runtime state out of `.codex/` and `.claude/`

For Codex, the installer manages project-local `.codex/hooks.json`. It does not fix every Codex feature/profile configuration. `doctor` reports whether hooks appear enabled through project or global `[features]`; if the user launches Codex with a custom profile, the user may need to enable `hooks = true` in that active profile. `doctor` also does not prove that Codex has reviewed and trusted a newly added command hook in the current thread.

For Claude Code, the installer manages project-local `.claude/settings.json`. It preserves unrelated top-level settings and unrelated hook entries, repairs stale epic-loop hook commands, and uses empty matchers for `SessionStart`, `UserPromptSubmit`, and `Stop`. It does not install bundled Claude plugin hook assets and does not edit global, user, managed, or local-personal Claude settings.

## Hook Payload

Hook payloads are JSON on stdin. Common useful fields:

- `session_id`
- `transcript_path`
- `cwd`
- `hook_event_name`
- `prompt` for `UserPromptSubmit`

Codex-specific useful fields:

- `turn_id`
- `last_assistant_message` for `Stop`

Claude Code-specific useful fields:

- `stop_hook_active` for `Stop`
- `last_assistant_message` for `Stop` when provided by the CLI
- `transcript_path` for assistant report capture and current-session detection

Route by `session_id` first. Use `cwd` as the project root boundary. Use `turn_id` only as best-effort event identity when present.

Codex report capture reads `last_assistant_message` from the `Stop` payload. Claude Code report capture prefers `last_assistant_message` when the CLI provides it, because it is the current Stop response; when that field is absent, it falls back to `transcript_path`, parses the JSONL transcript, and takes the latest assistant-role text entry.

Unbound sessions are silent no-ops. If `session_id` is absent from `.epic-loop/.runtime/session-bindings.json`, the hook handler must exit without writing files.

## Project-Local State

For bound sessions, the hook handler writes under:

```text
.epic-loop/
  epics/{epic-slug}/
    .runtime/sessions/{session_id}/...
  .runtime/
    hook-events/{session_id}/...
    sessions/{session_id}.json
    session-bindings.json
```

Do not store mutable epic-loop state under `.codex/`, `.claude/`, or top-level `epics/`. Those platform config folders are only static hook configuration entry points.

`.runtime/sessions/{session_id}.json` stores the latest known event, transcript path, cwd, model, and turn ids for registered epic-loop sessions only.

`.runtime/session-bindings.json` maps a session to an epic membership:

```json
{
  "sessions": {
    "019...": {
      "active": true,
      "epic_slug": "runtime-token-migration",
      "bound_at": "2026-05-05T00:00:00+00:00"
    }
  }
}
```

When a bound session emits a hook event, the handler also mirrors a lightweight event record into:

```text
.epic-loop/epics/{epic-slug}/.runtime/sessions/{session_id}/
```

## Binding Sessions

When resuming/orienting an existing epic by slug or path, auto-bind the current session as a mode-less member if the current-session capture is safe:

```bash
node <skill-dir>/scripts/auto-bind-session.mjs --current --slug "<epic-slug>"
node <skill-dir>/scripts/auto-bind-session.mjs --current --path ".epic-loop/epics/<epic-slug>"
```

Auto-bind accepts only a fresh `UserPromptSubmit` hook capture. For Codex, it deliberately rejects the mtime transcript fallback. For Claude Code, the capture must be fresh, match the project root, and include `session_id` plus `transcript_path`. If no acceptable capture exists, the script prints a skip notice and exits successfully so orientation can continue.

Auto-bind creates membership only. It does not change the epic mode, designate an implementation driver, or start the implementation loop.

Bind the current session explicitly after the user confirms that implementation should run in this session:

```bash
node <skill-dir>/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

This designates the current session as the exclusive implementation driver for the epic. Do not infer driver bindings from cwd alone when multiple sessions can run inside the same project. If `--current` cannot detect the current session for the selected platform, pass `--session-id "<session_id>"` explicitly.

For driver binding, Codex `--current` uses the existing Codex current-session capture and session metadata fallback. Claude Code `--current` reads only the Claude Code hook capture for the selected platform; the capture must be fresh, match the current project root, and include string `session_id` and `transcript_path`. If the Claude Code capture is missing, stale, malformed, wrong-root, or ambiguous, pass `--session-id "<session_id>"` explicitly.

Unbind on user request with `node <skill-dir>/scripts/unbind-session.mjs --current` (or `--session-id "<session_id>"`, optional `--reason`). It deactivates the session's entry in `session-bindings.json` (`active: false`, `deactivated_at`, `deactivated_reason`); hooks become silent no-ops for that session id afterwards. Unbinding an unbound session is a harmless no-op. Rebind later through the normal `bind-session.mjs` flow.

## What Hooks Can And Cannot Do

Hooks can:

- record lifecycle events for bound epic-loop sessions
- keep per-session state separate
- update project-local routing metadata
- prepare the next submode marker for the manager/techlead/engineer cycle
- inject a one-line compact marker via `hookSpecificOutput.additionalContext` on `UserPromptSubmit` for active member sessions in `shaping` or `review` mode: `[epic-loop] epic=<slug> mode=<mode> — follow epic-loop skill mode rules`
- inject an advisory implementation lock marker for non-driver member sessions while another session drives the implementation loop: `[epic-loop] epic=<slug> mode=implementation — loop running in another session; read-only, do not edit epic artifacts`
- continue the current session from `Stop` by returning `{ "decision": "block", "reason": "<prompt>" }`
- keep chaining Claude Code roles across `stop_hook_active: true` Stop reentries within the same turn; `stop_hook_active` is informational, not a hard gate, so each reentry records the role report and issues the next block continuation
- give an external runner enough data to recover the right session when hook continuation did not run

Hooks cannot be assumed to:

- continue an already-running thread before the selected platform has loaded and trusted the hook
- replace hook trust review or active-session hook loading
- exceed Claude Code's per-turn Stop-hook block cap; Claude Code overrides the hook after `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` consecutive blocks (default `8`, `0` = uncapped). Near a finite cap the loop pauses gracefully and asks the user to send `continue loop mode`, which starts a fresh turn and resets the counter

## Parallel Safety

For parallel sessions:

- each live platform session has its own `session_id`
- each session may be bound to one epic as an active member; the epic's runtime mode is shared by all members
- hook events are stored under `hook-events/{session_id}` only after the session is bound
- active epic writes should remain mode-owned where possible
- broad artifact rewrites require reading the file immediately before editing

If multiple sessions are bound to the same epic, prefer append-only logs and task-level ownership markers. During implementation, only the driver session should edit epic artifacts; non-driver members receive the advisory read-only lock marker.
