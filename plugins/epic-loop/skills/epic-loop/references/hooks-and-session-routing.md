# Hooks And Session Routing

## Goal

Epic-loop hooks must be project-local and session-aware. Parallel sessions in the same project must never route events only by cwd or epic slug.

## Local Config

Start with a read-only readiness check:

```bash
node <skill-dir>/scripts/doctor.mjs --json
```

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
.codex/hooks.json
```

The hook command points to the installed skill script and handles:

- `SessionStart`
- `UserPromptSubmit`
- `Stop`

The Codex feature flag `hooks = true` must still be enabled under `[features]` in the active Codex config/profile. Older configs may use `codex_hooks = true`; `doctor` accepts both names. The project-local hook config controls which hook command runs for this project.

Current public Codex behavior requires non-managed command hooks to be reviewed and trusted before they run. Use `/hooks` in the active Codex UI/CLI to inspect, trust, or disable hooks. A static readiness check cannot prove hook trust for the current already-running thread.

If `.codex/hooks.json` is not writable from the current Codex session, do not attempt workarounds. Give the user the install command and ask them to run it from a writable project checkout or host terminal.

If Codex hooks are not enabled, tell the user where the feature appears to be missing. Do not edit global `~/.codex/config.toml` from a project skill. Project-local config may be edited only after explicit user approval and only when it is writable.

User-facing setup messages should be tiny. Normal flow is:

```text
проверяю setup
проверила: нужно добавить hooks. Install now?
готово, hooks настроены. можем начинать epic.
```

Do not show full `doctor` output by default. Do not mention `ready: true`, config paths, global config, event lists, or other diagnostics unless the user asks. If install was attempted and failed, say that explicitly in one sentence.

## Installer Behavior

The installer must be conservative:

- preserve unrelated hook entries
- add missing epic-loop hook entries for `SessionStart`, `UserPromptSubmit`, and `Stop`
- replace stale epic-loop hook commands when the skill path changed
- refuse to overwrite invalid JSON
- support `--dry-run` without writing files
- keep mutable runtime state out of `.codex/`

The installer does not fix every Codex feature/profile configuration. Its job is project-local `.codex/hooks.json`. `doctor` reports whether hooks appear enabled through project or global `[features]`; if the user launches Codex with a custom profile, the user may need to enable `hooks = true` in that active profile. `doctor` also does not prove that Codex has reviewed and trusted a newly added command hook in the current thread.

## Hook Payload

Codex hook payloads are JSON on stdin. Observed useful fields:

- `session_id`
- `turn_id`
- `transcript_path`
- `cwd`
- `hook_event_name`
- `prompt` for `UserPromptSubmit`
- `last_assistant_message` for `Stop`

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
node <skill-dir>/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

This deactivates the previous active session for the same epic and mode. Do not infer bindings from cwd alone when multiple epic sessions can run inside the same project. If `--current` cannot detect the current Codex session, pass `--session-id "<session_id>"` explicitly.

## What Hooks Can And Cannot Do

Hooks can:

- record lifecycle events for bound epic-loop sessions
- keep per-session state separate
- update project-local routing metadata
- prepare the next submode marker for the manager/techlead/engineer cycle
- continue the current session from `Stop` by returning `{ "decision": "block", "reason": "<prompt>" }`
- give an external runner enough data to recover the right session when hook continuation did not run

Hooks cannot be assumed to:

- continue an already-running thread before Codex has loaded and trusted the hook
- replace hook trust review or active-session hook loading

## Parallel Safety

For parallel sessions:

- each live Codex session has its own `session_id`
- each session must be bound to one epic and mode
- hook events are stored under `hook-events/{session_id}` only after the session is bound
- active epic writes should remain mode-owned where possible
- broad artifact rewrites require reading the file immediately before editing

If two sessions are bound to the same epic and same mode, prefer append-only logs and task-level ownership markers.
