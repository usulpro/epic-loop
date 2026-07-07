# Epic-Centric Mode Model (v2)

Status: accepted during follow-up shaping on 2026-07-07. Supersedes the session-mode parts of the
"Accepted Plan (2026-07-07)" section in `docs/shaping-binding-gap.md` (see the superseded note there)
and the per-binding-mode decisions in `decision-log.md`.

## Core principle

**An epic is always in exactly one lifecycle mode.** The mode belongs to the epic, not to a session
binding. Any number of sessions may be bound to the same epic; they are all "in" the epic's current
mode and all receive the same mode marker. When one session changes the epic's mode, every bound
session picks up the change on its next turn — no rebinding.

## 1. Single machine-readable mode source

- Source of truth: the existing `mode` field in `.epic-loop/epics/<slug>/.runtime/runtime-state.json`,
  values `shaping | implementation | review`.
- Writers (scripts only, never hand edits):
  - `init-epic.mjs` → `shaping` (already does).
  - New `set-epic-mode.mjs --slug <slug> --mode <mode>` → explicit lifecycle transitions
    (reopen shaping, enter review, etc.). Validates the mode, updates `updated_at`.
  - Implementation start (`startImplementationLoop`) → `implementation` (already does).
- The human-facing `Current mode:` line in `state-of-epic.md` is **dropped**: removed from the
  `init-epic` template and no longer written or parsed by anything. `readEpicStateSummary` in
  `lib/loop.mjs` (which today regex-parses `state-of-epic.md` prose for `mode`) switches to
  `runtime-state.json`. `Active phase:` / `Active task:` prose lines are out of scope here.
- If `runtime-state.json` is missing or unreadable for a bound epic, hooks stay silent (no reminder,
  no crash); scripts that need the mode fail with an explicit error instead of guessing.

## 2. Binding = epic membership (no per-binding mode)

`.epic-loop/.runtime/session-bindings.json` v2:

```json
{
  "sessions": {
    "<session_id>": {
      "active": true,
      "epic_slug": "<slug>",
      "bound_at": "...",
      "activated_at": "...",
      "source": "current-claude-code-session"
    }
  }
}
```

- The `mode` field on a binding is removed. A binding only answers "which epic does this session
  belong to".
- **Many sessions may be active members of the same epic simultaneously** — all of them get
  reminders. Parallel work on *different* epics keeps working exactly as before: each session holds
  exactly one active binding, distinct epics never interact.
- The `active_sessions` map (`"<slug>:<mode>" -> session_id`) is **deleted from the schema**. It only
  existed to enforce one-session-per-epic/mode, which the membership model abolishes for
  shaping/review; the implementation driver moves to the epic's own runtime state (section 4). This
  removes the stale-pointer bug class *by construction* — the previous "clear stale active_sessions
  on rebind" fix becomes unnecessary.
- Rebinding a session to another epic rewrites only its own `sessions[session_id]` entry; nothing
  shared can go stale.
- Migration: the state is gitignored runtime data. Readers tolerate the old shape (ignore a leftover
  `mode` field and `active_sessions` map); no migration script needed.

## 3. Reminders follow the epic mode

On `UserPromptSubmit` for an active member session, the hook:

1. resolves the binding (unchanged strict opt-in: unbound sessions are silent no-ops),
2. reads the epic's `runtime-state.json` `mode`,
3. emits the compact marker for `shaping`/`review`; for `implementation` emits the **lock marker** to
   non-driver members and nothing to the driver.

Marker text (exact):

- `shaping`/`review`, every member: `[epic-loop] epic=<slug> mode=<mode> — follow epic-loop skill mode rules`
- `implementation`, non-driver members only: `[epic-loop] epic=<slug> mode=implementation — loop running in another session; read-only, do not edit epic artifacts`
- `implementation`, driver: nothing (the `Stop`-driven loop already carries role/mode context every turn).

The lock marker is advisory, not a mechanical write barrier: context injection disciplines the agent
in that session but cannot block writes. That is sufficient for the threat model (agent sessions
that read their injected context); it protects the loop's artifact writes (manager compaction,
implementation-log appends, tracker renders) from concurrent shaping edits.

- This supersedes the Phase 2 "no extra file read" decision: the reminder now costs one additional
  small JSON read per prompt (the hook already reads `session-bindings.json` and writes several
  event files per event; one more read is negligible and is the price of live mode propagation).
- Propagation guarantee: a mode change by any session (or by the implementation loop itself) is
  reflected in every member session's very next `UserPromptSubmit` — reminders appear, change, or
  stop accordingly.
- `SKILL.md` frontmatter description mentions the `[epic-loop] epic=... mode=...` marker pattern as a
  trigger (must keep the description ≤1024 chars; currently 895). A short body note explains: the
  marker means this session is a member of that epic in that mode; apply the existing mode rules.

## 4. Implementation mode keeps one exclusive driver

The Stop-hook loop must be driven by exactly one session, so implementation adds a driver on top of
membership:

- The driver session id is recorded in the epic's `runtime-state.json` under `implementation_loop`
  (explicit `driver_session_id`, alongside the existing `last_session_id` bookkeeping).
- Entering implementation (today's `bind-session --mode implementation` entry point) = bind
  membership + set epic mode to `implementation` + designate this session as driver + start the
  loop. Designating a new driver replaces the previous one.
- `maybeBuildImplementationContinuation` gates on: epic mode is `implementation` AND
  `payload.session_id === driver_session_id`.
- Turn-interruption (`markInterruptedTurnIfNeeded`) gates on the driver too: a `UserPromptSubmit`
  from a *non-driver* member session must NOT interrupt the loop.
- Non-driver members of an implementing epic get the read-only lock marker (section 3) and no loop
  output; only the driver is excluded from reminders entirely.
- If the driver session unbinds (`unbind-session.mjs`), the loop cannot continue: record the event
  and set the loop status to `idle` with a clear reason; resuming implementation designates a new
  driver through the normal start/resume flow.

## 5. Auto-bind on resume (simplified by this model)

Resuming an epic by slug/path binds the current session as a member — **no mode flag needed**; the
reminder follows the epic's current mode automatically:

- Epic mode `shaping`/`review` → bind membership; the marker appears from the next turn.
- Epic mode `implementation` → membership bind is still allowed (observer), but the explicit
  implementation start/resume confirmation flow is unchanged and no driver is designated
  automatically.
- Capture race guard (unchanged from v1 plan): the `--current` capture is last-writer-wins per
  project (15-min TTL, written by every session's every hook event), so auto-bind accepts it only
  when fresh AND `hook_event_name === "UserPromptSubmit"`. On Codex the mtime transcript fallback
  makes the race worse; the same guard applies. If no acceptable capture exists (e.g. hooks
  installed but not yet trusted in the running thread), skip auto-bind with a one-line notice and
  continue orientation.

## 6. Parallel-session semantics (v2)

- One worktree works one epic during implementation; the epic has one driver.
- Any number of sessions may shape or review the same epic **at the same time, in the same mode** —
  the epic's single mode is shared by all of them, and all receive the marker.
- "Multiple sessions on the same epic in *different* modes" is no longer a supported state: the epic
  mode is global to the epic. `SKILL.md`'s Parallel Work section and
  `references/parallel-sessions.md` must be updated accordingly (mode-owned artifact ownership
  simplifies to: the epic's current mode owns its artifacts; append-dated-entries discipline stays).

## 7. Consumers to switch off the old model

Known code touchpoints (implementation tasks map the full list):

- `lib/hooks.mjs`: `buildModeReminder` (source mode from epic runtime-state, not binding),
  `getSessionBinding` (drop `active_sessions` check), `maybeBuildImplementationContinuation` /
  `markInterruptedTurnIfNeeded` call sites (driver gate).
- `lib/epics.mjs`: `bindSession` (membership + driver designation split, drop `active_sessions`),
  `unbindSession` (drop `active_sessions` cleanup, add driver-unbind loop pause), `init-epic`
  template (drop `Current mode:` line).
- `lib/loop.mjs`: `readEpicStateSummary` (stop parsing prose `Current mode`), `startImplementationLoop`
  (driver designation), loop summaries that expose `mode`.
- `scripts/unbind-session.mjs`, `scripts/bind-session.mjs` CLI docs; `role-summary.mjs` output if it
  prints binding mode.
- Tests: `tests/unit/unbind-and-reminder.test.mjs`, `hook-contracts.test.mjs`,
  `cli-contracts.test.mjs` contracts pinned to the old schema.
- Docs: `SKILL.md` (Hooks, Parallel Work, resume flow), `references/hooks-and-session-routing.md`,
  `references/parallel-sessions.md`, `docs/mode-reminder-design.md` (superseded note).
