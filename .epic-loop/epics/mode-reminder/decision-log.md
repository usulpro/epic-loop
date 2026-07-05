# Decision Log

## Active Decisions

- The per-turn mode reminder will use `hookSpecificOutput.additionalContext` on `UserPromptSubmit`, the same field name and shape on both Claude Code and Codex CLI. Confirmed via `developers.openai.com/codex/hooks` that Codex supports this field identically to Claude Code. **Not yet confirmed by a real POC on either platform** — Phase 3 of this epic exists specifically to verify this against actual running agents, not just docs.
- Codex's TUI may render `additionalContext` as a visible developer message (per `openai/codex` issues #16486, #16933), unlike Claude Code where it behaves more like an invisible system-reminder. Decision: accept this difference as-is; a visible reminder is a transparency plus, not a defect to mask.
- The new detach script is named `unbind-session.mjs`, for naming consistency with the existing `bind-session.mjs`.
- The unbind trigger should not be a single rigid memorized phrase. The agent should recognize user intent to work outside the epic (e.g. "do this right now", "let's work without the epic for a bit") and call `unbind-session.mjs` proactively, while a short canonical phrase is still designed as a reliable fallback and is made explicit in `SKILL.md`'s frontmatter description. Exact phrase to be decided in Phase 4.
- Rebinding/resuming after an unbind reuses the existing resume flow; no new reattach mechanism is assumed necessary unless Phase 1 design work finds a gap.
- Phase 3 runs Codex's POC first, then Claude Code's POC, with an explicit stop-and-switch task in between. Each platform must run its own POC from a real session on that platform — not simulated from the other platform — so the evidence is genuine per-platform proof, not a cross-platform guess.
- Phase 2 design proposal accepted (`docs/mode-reminder-design.md`): the mode reminder is built by a new `buildModeReminder(payload, binding)` in `lib/hooks.mjs` (not `loop.mjs`), sourced solely from `binding.mode` in the already-loaded `session-bindings.json` — no extra file reads. It fires only for bound `shaping`/`review` sessions on `UserPromptSubmit`; implementation-mode sessions are excluded because the existing `Stop`-driven loop machinery already carries role/mode context every turn.
- `handleHook`'s only control-flow change is a fallback: `maybeBuildImplementationContinuation(...) ?? buildModeReminder(...)`. The two builders are mutually exclusive by construction (one requires `binding.mode === "implementation"`, the other requires it not to be), so no branching logic was added.
- Reminder text is fixed to one line per mode (see `docs/mode-reminder-design.md` section 1), prefixed `[epic-loop]`, naming the epic slug and pointing at the relevant `SKILL.md` rule section. Wording may be tuned after Phase 3 POC evidence, but the mechanism and source do not change.
- `unbind-session.mjs` takes `--current`/`--session-id` (matching `bind-session.mjs`'s detection semantics) plus an optional `--reason`, but deliberately has no `--slug`/`--mode` — it deactivates whatever epic/mode the resolved session id is currently actively bound to, since a session can only ever hold one active binding.
- Unbinding sets `active: false`, `deactivated_at`, and a new additive `deactivated_reason` field on the session's `session-bindings.json` entry (mirroring the shape `bindSession` already writes when a different session supersedes one), and clears the `active_sessions["<slug>:<mode>"]` pointer if it still points at this session id. No schema change for any other reader. A no-op (exit 0) if the session is already unbound or was never bound.

## Historical Decisions

- None recorded yet.
