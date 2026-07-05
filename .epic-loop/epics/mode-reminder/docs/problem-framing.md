# Epic Problem Framing

## Problem

In shaping and review lifecycle modes, the agent tends to drift: after enough turns in a long conversation, a plain imperative from the user ("do X", "research Y") gets executed immediately as an action instead of being captured as a task in `tracker.md`. A textual rule was already added to `SKILL.md` (Shaping/Review Rules) asking the agent to default to task-capture and to announce which interpretation it is using, but this relies on the agent remembering which mode is active purely from conversation context, which degrades over a long session.

Separately, there is no way for a user to tell an already-bound session "stop treating my instructions as epic work for a while" without leaving the session or waiting for it to end. The user may want to do a quick unrelated check or change in the same session, then come back to the epic later.

## Desired Outcome

1. A deterministic, harness-level mechanism (not reliant on model memory) reminds the agent of the active epic-loop mode on every user turn, for any bound session — not just implementation mode, which is already handled by the existing loop machinery.
2. The mechanism works identically, or with an explicitly documented difference, on both supported platforms: Claude Code and Codex CLI. Parity between platforms is a hard requirement for this repo (see `CLAUDE.md`).
3. A session that is bound to an epic can be explicitly unbound ("detached") on user intent, so hook-driven behavior becomes a silent no-op for it again, exactly like a session that never worked with an epic. The session can rebind/resume later through the existing resume flow.
4. Sessions that were never bound to any epic remain provably unaffected by this feature.
5. There is a concrete, ideally ultra-short, phrase (or intent pattern) that reliably signals "detach from the epic for now" to the agent, is documented in the skill's frontmatter `description` and body, and does not require the user to remember a rigid exact incantation.

## Scope

- Extending the `UserPromptSubmit` hook path (`scripts/lib/hooks.mjs` / `scripts/lib/loop.mjs`) to inject a per-turn mode reminder for shaping/review-bound sessions via `hookSpecificOutput.additionalContext`.
- A new `unbind-session.mjs` script (naming consistent with the existing `bind-session.mjs`) that deactivates the *current* session's binding on request, mirroring the deactivation logic already used in `lib/epics.mjs`'s `bindSession` when a different session takes over the same epic/mode.
- Real, hands-on proof-of-concept validation that the `additionalContext` injection actually works end-to-end on both Claude Code and Codex CLI, not just documentation research.
- Designing the short trigger phrase/intent pattern for unbind, and wiring it into `SKILL.md`'s frontmatter description and body so the skill engages unambiguously and then knows the detach state.
- Unit tests for the new hook behavior and the unbind script, following this repo's existing `node --test` / `runNodeScript` conventions.

## Non-Scope

- Changing the implementation-mode `UserPromptSubmit`/`Stop` interrupted-turn logic, which already exists and is out of scope for this epic.
- Building a general-purpose notification/reminder system unrelated to epic-loop mode tracking.
- Redesigning the `bind-session.mjs` binding data model; this epic only adds a symmetric unbind operation on top of the existing `session-bindings.json` shape.

## Constraints

- Must preserve the existing, tested guarantee that unbound sessions produce zero epic-loop hook output (`hooks.mjs`'s `getSessionBinding` early-return gate).
- Must not rely on re-reading `state-of-epic.md` in full on every turn; the reminder should be cheap, sourced from the lightweight session-bindings/runtime-state mode field.
- Codex hooks are an experimental, disabled-by-default feature (`hooks = true` under `[features]`); the design must not assume they are always available and must degrade the same way existing epic-loop hooks already do when Codex hooks are off.
- Codex's TUI may render `additionalContext` as a visible "developer message" rather than an invisible system-reminder the way Claude Code does. This is accepted as a transparency plus, not treated as a bug to hide.
- The unbind trigger should favor recognizing user intent (e.g. "do this right now", "let's work without the epic for a bit") over requiring one memorized fixed phrase, while still needing one clearly documented canonical phrase for reliability.

## Open Questions

- Exact wording of the injected per-turn reminder text for shaping vs. review mode.
- Exact canonical short phrase for unbind, and how it should read in `SKILL.md`'s description vs. body.
- Whether `unbind-session.mjs` needs `--current`/`--session-id` semantics identical to `bind-session.mjs`, or a simpler current-session-only form.
- Whether re-binding after an unbind should require the full resume flow or a lighter-weight "reattach" shortcut.
