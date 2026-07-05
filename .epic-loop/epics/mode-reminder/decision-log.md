# Decision Log

## Active Decisions

- The per-turn mode reminder will use `hookSpecificOutput.additionalContext` on `UserPromptSubmit`, the same field name and shape on both Claude Code and Codex CLI. Confirmed via `developers.openai.com/codex/hooks` that Codex supports this field identically to Claude Code. **Not yet confirmed by a real POC on either platform** — Phase 3 of this epic exists specifically to verify this against actual running agents, not just docs.
- Codex's TUI may render `additionalContext` as a visible developer message (per `openai/codex` issues #16486, #16933), unlike Claude Code where it behaves more like an invisible system-reminder. Decision: accept this difference as-is; a visible reminder is a transparency plus, not a defect to mask.
- The new detach script is named `unbind-session.mjs`, for naming consistency with the existing `bind-session.mjs`.
- The unbind trigger should not be a single rigid memorized phrase. The agent should recognize user intent to work outside the epic (e.g. "do this right now", "let's work without the epic for a bit") and call `unbind-session.mjs` proactively, while a short canonical phrase is still designed as a reliable fallback and is made explicit in `SKILL.md`'s frontmatter description. Exact phrase to be decided in Phase 4.
- Rebinding/resuming after an unbind reuses the existing resume flow; no new reattach mechanism is assumed necessary unless Phase 1 design work finds a gap.
- Phase 3 runs Codex's POC first, then Claude Code's POC, with an explicit stop-and-switch task in between. Each platform must run its own POC from a real session on that platform — not simulated from the other platform — so the evidence is genuine per-platform proof, not a cross-platform guess.

## Historical Decisions

- None recorded yet.
