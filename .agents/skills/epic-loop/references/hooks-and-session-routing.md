# Hooks And Session Routing

## Goal

Epic-loop hooks must be project-local and session-aware. Parallel sessions in the same project must never route events only by cwd or epic slug.

## Local Config

Install hooks from the project root:

```bash
node .agents/skills/epic-loop/scripts/epic-loop.mjs install-hooks
```

This creates or updates:

```text
.codex/hooks.json
```

The hook command points to the installed skill script and handles:

- `SessionStart`
- `UserPromptSubmit`
- `Stop`

The Codex feature flag `codex_hooks = true` must still be enabled in the active Codex config/profile. The project-local hook config controls which hook command runs for this project.

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

Unbound sessions are silent no-ops. If `session_id` is absent from `.epic-loop/session-bindings.json`, the hook handler must exit without writing files.

## Project-Local State

For bound sessions, the hook handler writes under:

```text
.epic-loop/
  hook-events/{session_id}/...
  sessions/{session_id}.json
  session-bindings.json
```

Do not store mutable epic-loop runtime state under `.codex/`. Codex may mount `.codex/` read-only inside normal sandboxed project sessions. `.codex/hooks.json` is only the static hook configuration entry point.

`sessions/{session_id}.json` stores the latest known event, transcript path, cwd, model, and turn ids for registered epic-loop sessions only.

`session-bindings.json` maps a session to an epic:

```json
{
  "sessions": {
    "019...": {
      "epic_slug": "runtime-token-migration",
      "mode": "implementation",
      "bound_at": "2026-05-05T00:00:00+00:00"
    }
  }
}
```

When a bound session emits a hook event, the handler also mirrors a lightweight event record into:

```text
epics/{epic-slug}/sessions/{session_id}/
```

## Binding Sessions

Bind explicitly:

```bash
node .agents/skills/epic-loop/scripts/epic-loop.mjs bind-session --session-id "<session_id>" --slug "<epic-slug>" --mode implementation
```

Do not infer bindings from cwd alone when multiple epic sessions can run inside the same project.

## What Hooks Can And Cannot Do

Hooks can:

- record lifecycle events for bound epic-loop sessions
- keep per-session state separate
- update project-local routing metadata
- prepare the next submode marker for the techlead/engineer cycle
- give an external runner enough data to continue the right session

Passive hooks cannot by themselves inject text into a live Codex terminal. To send a continuation prompt to the correct session, use a wrapper/runner that owns the PTY for that session and matches hook events by `session_id` and run identity.

## Parallel Safety

For parallel sessions:

- each live Codex session has its own `session_id`
- each session must be bound to one epic and mode
- hook events are stored under `hook-events/{session_id}` only after the session is bound
- active epic writes should remain mode-owned where possible
- broad artifact rewrites require reading the file immediately before editing

If two sessions are bound to the same epic and same mode, prefer append-only logs and task-level ownership markers.
