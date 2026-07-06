# Shaping Binding Gap

## Summary

The mode reminder implementation works for sessions that are already bound in `shaping` or `review` mode, but the normal new-epic shaping flow does not automatically create that binding.

Observed on 2026-07-06:

- A new `set-up` epic was created and shaped through epic artifacts.
- The session was not registered in `.epic-loop/.runtime/session-bindings.json` during normal shaping.
- Because the hook is intentionally bound-session-only, `UserPromptSubmit` produced no `hookSpecificOutput.additionalContext`.
- Manually running `bind-session.mjs --current --slug set-up --mode shaping` made the next turn receive the expected reminder.

## Additional Binding Consistency Issue

After manually switching the same session from `set-up:shaping` to `mode-reminder:shaping`, the primary session entry changed to `mode-reminder` and `mode: shaping`, but `active_sessions["set-up:shaping"]` still pointed at the same session id.

That means the binding model currently allows a stale active-session pointer for a previous epic/mode even though the session entry itself can only represent one active binding.

## Problem Statement

There are two related gaps:

1. Shaping/review reminders depend on explicit runtime binding, but the normal shaping/resume path does not bind the session.
2. Rebinding a session to another epic/mode can leave stale `active_sessions` pointers for the old epic/mode.

## Desired Direction

- Define when shaping/review sessions should be bound automatically or explicitly.
- Make binding semantics internally consistent: one active session entry should not leave stale active pointers for older epic/mode pairs.
- Preserve the strict guarantee that unbound sessions produce no epic-loop hook output.
- Keep implementation-mode binding semantics unchanged unless the same consistency fix is needed there.
