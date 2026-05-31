# Hooks And Session Routing

## Goal

Epic-loop hooks must be project-local and session-aware. Parallel sessions in the same project must never route events only by cwd or epic slug.

## Local Config

Start with a read-only readiness check:

```bash
node .agents/skills/epic-loop/scripts/doctor.mjs --json
```

If setup is needed, preview the changes:

```bash
node .agents/skills/epic-loop/scripts/install-hooks.mjs --dry-run
```

Install hooks from the project root only after user approval:

```bash
node .agents/skills/epic-loop/scripts/install-hooks.mjs
```

This creates or updates:

```text
.codex/hooks.json
```

The hook command points to the installed skill script and handles:

- `SessionStart`
- `UserPromptSubmit`
- `Stop`

The Codex feature flag `hooks = true` must still be enabled in the active Codex config/profile. The project-local hook config controls which hook command runs for this project.

If `.codex/hooks.json` is not writable from the current Codex session, do not attempt workarounds. Give the user the install command and ask them to run it from a writable project checkout or host terminal.

If `hooks` is not enabled, tell the user where the feature appears to be missing. Do not edit global `~/.codex/config.toml` from a project skill. Project-local config may be edited only after explicit user approval and only when it is writable.

User-facing setup messages should be tiny. Normal flow is:

```text
проверяю setup
проверила: нужно добавить hooks. Install now?
готово, hooks настроены. можем начинать epic.
```

Do not show full `doctor` output by default. Do not mention `ready: true`, config paths, global config, event lists, or other diagnostics unless the user asks. If install was attempted and failed, say that explicitly in one sentence.

## Platform Targets (Codex and Claude Code)

epic-loop drives the same loop on Codex and Claude Code because both expose the
same `Stop`-hook continuation contract. `doctor`, `install-hooks`, `bind-session`,
and `debug` auto-detect the platform (Claude Code sets `CLAUDECODE=1`; otherwise
Codex is assumed) and accept an explicit `--platform codex|claude` override.

What differs by platform:

| Concern | Codex | Claude Code |
| --- | --- | --- |
| Hook config file | `.codex/hooks.json` | `.claude/settings.json` (shared file; installer deep-merges the `hooks` block and preserves other keys) |
| Feature flag | `hooks = true` under `[features]` | none required |
| Hook command | `node …/hook.mjs --platform codex` | `node …/hook.mjs --platform claude` |
| `--current` session source | `.codex/tmp/last-hook-capture.json`, then `~/.codex/sessions/**/*.jsonl` | newest `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` (filename is the session id) |
| Engineer report source on `Stop` | `payload.last_assistant_message` | last `assistant` entry read from `transcript_path` |

What is identical: the hook config entry shape, the stdin payload fields the
handler routes on (`session_id`, `cwd`, `hook_event_name`, `transcript_path`,
`stop_hook_active`), the three events, the silent-no-op-when-unbound rule, the
binding store, and the continuation contract `{ "decision": "block", "reason":
"<next prompt>" }`. Only the platform-specific install/detection code branches;
`hook.mjs` and the loop engine are shared unchanged.

For Claude Code discoverability the skill is exposed at `.claude/skills/epic-loop`
as a symlink to the single source of truth in `.agents/skills/epic-loop`, so there
is no duplicated copy to drift.

## Installer Behavior

The installer must be conservative:

- preserve unrelated hook entries
- add missing epic-loop hook entries for `SessionStart`, `UserPromptSubmit`, and `Stop`
- replace stale epic-loop hook commands when the skill path changed
- refuse to overwrite invalid JSON
- support `--dry-run` without writing files
- keep mutable runtime state out of `.codex/`

The installer does not fix every Codex feature/profile configuration. Its job is project-local `.codex/hooks.json`. `doctor` reports whether `hooks` appears enabled through project or global `[features]`; if the user launches Codex with a custom profile, the user may need to enable `hooks = true` in that active profile.

## Hook Payload

Codex and Claude Code hook payloads are JSON on stdin. Shared useful fields:

- `session_id`
- `transcript_path`
- `cwd`
- `hook_event_name`
- `stop_hook_active`
- `prompt` for `UserPromptSubmit`

Codex-only fields the handler tolerates but does not require: `turn_id`, and
`last_assistant_message` for `Stop`. On Claude Code there is no
`last_assistant_message`; the engineer report is read from `transcript_path`.

Route by `session_id` first. Use `cwd` as the project root boundary. Use `turn_id` only as event identity inside a registered session.

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

Do not store mutable epic-loop state under `.codex/` or in top-level `epics/`. Codex may mount `.codex/` read-only inside normal sandboxed project sessions. `.codex/hooks.json` is only the static hook configuration entry point.

`.runtime/sessions/{session_id}.json` stores the latest known event, transcript path, cwd, model, and turn ids for registered epic-loop sessions only.

`.runtime/session-bindings.json` maps a session to an epic:

```json
{
  "active_sessions": {
    "runtime-token-migration:implementation": "019..."
  },
  "sessions": {
    "019...": {
      "active": true,
      "epic_slug": "runtime-token-migration",
      "mode": "implementation",
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

Bind the current session explicitly after the user confirms that implementation should run in this session:

```bash
node .agents/skills/epic-loop/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

This deactivates the previous active session for the same epic and mode. Do not infer bindings from cwd alone when multiple epic sessions can run inside the same project. If `--current` cannot detect the current Codex session, pass `--session-id "<session_id>"` explicitly.

## What Hooks Can And Cannot Do

Hooks can:

- record lifecycle events for bound epic-loop sessions
- keep per-session state separate
- update project-local routing metadata
- prepare the next submode marker for the techlead/engineer cycle
- give an external runner enough data to continue the right session

## Parallel Safety

For parallel sessions:

- each live Codex session has its own `session_id`
- each session must be bound to one epic and mode
- hook events are stored under `hook-events/{session_id}` only after the session is bound
- active epic writes should remain mode-owned where possible
- broad artifact rewrites require reading the file immediately before editing

If two sessions are bound to the same epic and same mode, prefer append-only logs and task-level ownership markers.
