# Parallel Sessions

## Rule

One session works in one mode at a time. One epic may have multiple sessions in different modes.

For hook-driven routing, only one session may be active for a given epic and mode. When the user explicitly says to run implementation in the current session, bind the current session and deactivate the previous active implementation session for that epic.

Examples:

- implementation executes the current phase
- shaping prepares future phases
- review inspects a completed slice
- reset replaces stale architecture

## Collision Avoidance

Before editing artifacts, read the current file from disk. Prefer append-only entries for logs and registers.

Mode ownership:

- Shaping: docs, future roadmap, open questions, task decomposition.
- Implementation: active task status, implementation log, verification notes, execution brief.
- Review: findings, drift analysis, follow-up proposals.
- Reset: historical baseline, active plan replacement, reset decision.

If two sessions need the same artifact, use dated sections with the mode name.

## State Updates

Use `.epic-loop/session-bindings.json` as the source of truth for active hook-routed sessions. Historical or inactive sessions may remain recorded, but hooks should ignore them.

`state-of-epic.md` should reflect the latest known whole-epic state. Keep it concise and edit it carefully. It is acceptable for parallel sessions to add a short note rather than rewrite the entire file.

## When To Pause

Pause and ask the user when:

- two sessions need incompatible changes to active architecture
- implementation would proceed on assumptions review just invalidated
- reset would obsolete work currently being implemented
