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

## Accepted Plan (2026-07-07)

> **Superseded later the same day (2026-07-07):** the session-mode parts of this plan were replaced
> by the epic-centric mode model in `docs/epic-mode-model.md` — the epic holds exactly one mode in
> `runtime-state.json`, bindings are mode-less epic membership, any number of sessions per epic get
> reminders, and `active_sessions` is deleted (which removes item 1's stale-pointer bug class by
> construction). The compact marker text, the capture race guard, and the auto-bind skip behavior
> below carried over into the new model unchanged. Kept for history.

Accepted during follow-up shaping; tracked as **Phase 7 — Fix Session Binding Lifecycle And Compact Reminder** in `tracker.md`. Task order is deliberate: 1 → 2 → 3 → 4 → verification (task 4 depends on 1 for pointer hygiene and on 3 for its mode source; 2 lands before 4 so auto-bind tests assert the final reminder text).

### 1. Rebind cleanup (`bindSession`)

`bindSession` currently deactivates *other* sessions holding the same `slug:mode` key but never removes the *same* session's old `active_sessions` key when it rebinds to a different epic/mode — the session entry is overwritten while the old pointer survives. `getSessionBinding`'s dual check (`active === true` AND `active_sessions[key] === sessionId`) means reminders are unaffected, but the stale pointer lies to anything reading `active_sessions` directly (e.g. `previousSessionId` reporting). Fix: on bind, delete every `active_sessions` entry pointing at this session id except the new key — symmetric to what `unbindSession` already does for its own key.

### 2. Compact mode marker

Reminder text becomes exactly `[epic-loop] epic=<slug> mode=<mode> — follow epic-loop skill mode rules`. Rationale: the verbose per-mode one-liners duplicate `SKILL.md` rules on every turn; the marker plus a minimal action hint is cheaper and triggers the skill via the frontmatter description (which must mention the marker pattern and stay ≤1024 chars; currently 895). A fully bare marker was rejected — without a verb it risks being ignored when `SKILL.md` is not yet in context.

### 3. Machine-readable epic mode

The epic's lifecycle mode already exists machine-readably as the `mode` field in `.epic-loop/epics/<slug>/.runtime/runtime-state.json`; the gap is that only `init-epic` (sets `shaping`) and `startImplementationLoop` (sets `implementation`) write it, so it goes stale when shaping reopens or review starts (this epic itself: runtime `mode: implementation` while actually shaping). Fix: a `set-epic-mode.mjs` script (or `lib/epics.mjs` helper) validates and writes `mode` + `updated_at`, and `SKILL.md` instructs the agent to call it on every lifecycle transition. `state-of-epic.md`'s `Current mode:` line stays as human-facing information only — no machine flow parses prose.

### 4. Auto-bind on resume

Resuming an epic by slug/path binds the current session with the epic's current mode **only when that mode is `shaping` or `review`** (safe: `bindSession` starts loop machinery only for `implementation`). The implementation/idle resume path keeps the existing explicit-confirmation flow, unchanged. Race guard: the `--current` capture is last-writer-wins per project (15-min TTL, written by every session's every hook event), so auto-bind accepts it only when fresh AND `hook_event_name === "UserPromptSubmit"`; the Codex mtime fallback makes the race worse there, same guard applies. If no acceptable capture exists (e.g. hooks installed but not yet trusted in the running thread — the only realistic failure, since `doctor` gates the flow on hook setup), auto-bind is skipped with a one-line notice and orientation continues.

### Parallel-session semantics (accepted as-is)

One worktree works one epic during implementation; parallel sessions are expected in shaping/review only. Parallel shaping across different epics works (distinct `slug:mode` keys). Two sessions in the same mode on the same epic share one hook-routed slot by design: the last bind wins and silently deactivates the previous session's reminders. Auto-bind makes this takeover implicit on resume, which is accepted; `bind-session` already reports the deactivated previous session id.
