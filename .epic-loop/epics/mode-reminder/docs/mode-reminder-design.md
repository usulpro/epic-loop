# Mode Reminder + Unbind Design Proposal

Status: historical Phase 2 design. POC validation and the original implementation completed in Phases 3-5, but the reminder source/text portions are superseded by the accepted epic-centric model in `docs/epic-mode-model.md` (2026-07-07): mode now comes from epic runtime state, bindings are mode-less members, shaping/review use the compact marker, and implementation non-driver members receive a read-only lock marker.

## 1. Per-Turn Mode Reminder (`UserPromptSubmit`)

### Where it fires

- Only for **bound** sessions (`getSessionBinding` in `lib/hooks.mjs` already gates this; unbound sessions never reach the new code path).
- Only when `binding.mode` is `"shaping"` or `"review"`. Implementation-mode sessions are explicitly out of scope: they already get role-scoped context on every `Stop`-driven continuation from `maybeBuildImplementationContinuation`, so a second `UserPromptSubmit` reminder would be redundant.
- Only on `payload.hook_event_name === "UserPromptSubmit"`.

### Source of the mode value

Historical design: `binding.mode` from `.epic-loop/.runtime/session-bindings.json`.

Current design: `runtime-state.json` `mode` from the epic runtime state. This supersedes the "no additional file read" constraint so mode changes propagate to every active member session without rebinding.

### New function

Add `buildModeReminder(binding)` in `scripts/lib/hooks.mjs` (co-located with `handleHook`, not `loop.mjs`, since this is not implementation-loop machinery):

```js
function buildModeReminder(payload, binding) {
  if (payload.hook_event_name !== "UserPromptSubmit") {
    return null;
  }
  if (binding.mode !== "shaping" && binding.mode !== "review") {
    return null;
  }

  const text = MODE_REMINDER_TEXT[binding.mode](binding.epic_slug);

  return {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: text,
    },
  };
}
```

### Injected text (one line per mode, per the risk register's "keep it to one short line")

```js
const MODE_REMINDER_TEXT = {
  marker: (slug, mode) => `[epic-loop] epic=${slug} mode=${mode} — follow epic-loop skill mode rules`,
  implementationLock: (slug) =>
    `[epic-loop] epic=${slug} mode=implementation — loop running in another session; read-only, do not edit epic artifacts`,
};
```

Exact wording may be tuned after Phase 3 POC shows how each platform actually renders `additionalContext` (e.g. shortened further if Codex's visible rendering makes it feel noisy), but the shape and source stay the same.

### Wiring into `handleHook`

`handleHook` currently only ever produces stdout for `Stop`:

```js
const continuation = maybeBuildImplementationContinuation(projectRoot, payload, binding);
if (continuation) {
  console.log(JSON.stringify(continuation));
}
```

Both `maybeBuildImplementationContinuation` (gates on `binding.mode === "implementation"` and `hook_event_name === "Stop"`) and the new mode-reminder builder (gates on `binding.mode !== "implementation"` and `hook_event_name === "UserPromptSubmit"`) are mutually exclusive by construction, so they compose with a single fallback, no branching needed:

```js
const continuation =
  maybeBuildImplementationContinuation(projectRoot, payload, binding) ??
  buildModeReminder(payload, binding);
if (continuation) {
  console.log(JSON.stringify(continuation));
}
```

This is the only change to `handleHook`'s control flow. No new files, no new runtime state, no schema change.

### Platform output shape

Both platforms are assumed (per `decision-log.md`, pending Phase 3 proof) to support the same Claude-Code-style shape:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "<text>"
  }
}
```

Claude Code renders `additionalContext` as invisible model context (a system-reminder-like injection). Codex may render it as a visible "developer message" per `openai/codex` issues #16486/#16933 — accepted as-is (see `decision-log.md`). Phase 3 either confirms this shape on both platforms or records a per-platform correction here and in `decision-log.md`.

### Lifecycle-mode behavior table

| Binding state | `UserPromptSubmit` behavior |
| --- | --- |
| Unbound session | No-op (unchanged; gated by `getSessionBinding` before any new code runs) |
| Bound member, epic mode `shaping` | Compact `additionalContext` marker injected every turn |
| Bound member, epic mode `review` | Compact `additionalContext` marker injected every turn |
| Bound member, epic mode `implementation`, driver session | No reminder; existing loop machinery (`Stop`-driven continuations) already carries role/mode context every turn |
| Bound member, epic mode `implementation`, non-driver session | Read-only lock marker injected every turn |

## 2. `unbind-session.mjs`

### Purpose

Deactivate the *current* session's binding on user intent, mirroring the deactivation branch already present in `bindSession` (`lib/epics.mjs`) when a different session takes over the same epic/mode slot — but triggered directly by the bound session itself, for whatever epic/mode it currently holds.

### CLI shape

```bash
node <skill-dir>/scripts/unbind-session.mjs --current
node <skill-dir>/scripts/unbind-session.mjs --session-id "<session_id>"
node <skill-dir>/scripts/unbind-session.mjs --current --reason "quick unrelated check"
```

- `--current` / `--session-id`: identical detection semantics to `bind-session.mjs` (`readCurrentClaudeSession` / `readCurrentCodexSession` per the configured platform; if `--current` can't detect a fresh, matching-root capture, require `--session-id` explicitly — same failure message pattern as `bindSession`).
- No `--slug` / `--mode` flags. Unlike `bind-session.mjs`, `unbind-session.mjs` does not target a specific epic/mode — it unbinds whatever the resolved session id is *currently* actively bound to. This is deliberately simpler than `bind-session.mjs` because there is only ever at most one active binding per session id.
- `--reason` (optional, free text): recorded for debugging/audit; defaults to `"user-requested-unbind"`.

### Behavior

1. Resolve `sessionId` (via `--current` or `--session-id`), same as `bindSession`.
2. Read `.epic-loop/.runtime/session-bindings.json`.
3. If `sessions[sessionId]` is missing or `active !== true`: print `Session <id> is not currently bound to any epic.` and exit 0 (no-op, not an error — matches the idempotent spirit of the existing bind/deactivate logic).
4. Otherwise, capture `{ epic_slug, mode }` from the existing binding, then:
   - Set `sessions[sessionId] = { ...binding, active: false, deactivated_at: <now>, deactivated_reason: <reason> }`. This mirrors the exact shape `bindSession` already writes when a *different* session supersedes this one (`active: false, deactivated_at`), plus one new optional field (`deactivated_reason`) that is additive and does not change the existing schema for any other reader.
   - If `active_sessions["<epic_slug>:<mode>"] === sessionId`, delete that key (so no stale active-session pointer survives; `getSessionBinding`'s `activeSessions[activeKey] !== sessionId` check would already independently return `null` for this session, but clearing it keeps `session-bindings.json` honest for anything else that reads `active_sessions` directly, e.g. `bind-session --current`'s previous-session reporting).
5. Write `session-bindings.json` back.
6. Mirror an unbind record into the epic-side session folder, next to the existing `binding.json` written by `bindSession`:
   `.epic-loop/epics/{epic_slug}/.runtime/sessions/{sessionId}/unbind.json` — `{ unbound_at, epic_slug, mode, reason, session_id }`.
7. Print `Session <id> unbound from <epic_slug> (<mode>).`

### Data model impact

None beyond the additive `deactivated_reason` field described above. `session-bindings.json`'s existing shape (`sessions`, `active_sessions`) is unchanged; `getSessionBinding`'s existing gate logic (`binding.active !== true` / `activeSessions[activeKey] !== sessionId`) needs no changes — it already treats a deactivated session as unbound.

### Guarantee for unbound/never-bound sessions

Unaffected. `unbind-session.mjs` only ever mutates an existing, currently-active entry in `session-bindings.json`; it never creates a new binding. A session that was never bound, or that is already inactive, is a no-op call (step 3 above).

### Re-binding after unbind

Per `decision-log.md`: reuses the existing resume/`bind-session --current` flow. No new "reattach" shortcut. Calling `bind-session.mjs --current --slug <slug> --mode <mode>` again for the same session id simply reactivates it exactly as it does today for a fresh bind.

## 3. Open questions resolved by this proposal

- **Reminder wording**: fixed one-liners above, per mode (subject to Phase 3 tuning).
- **`unbind-session.mjs` flag shape**: `--current` / `--session-id` matching `bind-session.mjs`, but no `--slug` / `--mode` (acts on whatever the session is currently bound to).
- **Re-binding after unbind**: existing resume flow, no new mechanism (already decided; restated here for completeness).

## 4. Explicitly deferred to later phases

- Phase 3: prove the `additionalContext` shape and rendering on both platforms with real running sessions; correct this doc/`decision-log.md` if either platform's actual behavior differs.
- Phase 4: the canonical short unbind trigger phrase and the `SKILL.md` intent-recognition rule around it. This doc only fixes the *mechanism* (`unbind-session.mjs`); it deliberately does not fix the *phrase*.
- Phase 5: implementation of both pieces, plus unit tests per the table in section 1 and the no-op guarantee in section 2.
