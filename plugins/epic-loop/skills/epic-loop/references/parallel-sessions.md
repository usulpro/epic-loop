# Parallel Sessions

## Rule

One session may be an active member of one epic at a time. An epic has one shared runtime mode, so multiple sessions on the same epic are in the same mode; same-epic different-mode sessions are not supported.

For hook-driven routing, many sessions may be active members of one epic. When the epic is in implementation mode, exactly one session is the implementation driver; other member sessions are read-only observers and receive the implementation lock marker.

Examples:

- implementation driver executes the current phase
- implementation non-driver members observe only and do not edit epic artifacts
- shaping prepares future phases, including architecture reset when needed
- review inspects a completed slice

## Collision Avoidance

Before editing artifacts, read the current file from disk. Prefer append-only entries for logs and registers.

Mode ownership:

- Shaping: docs, future roadmap, open questions, task decomposition, and reset/baseline transitions when the reset ladder is invoked.
- Implementation manager housekeeping: compaction of inactive non-doc layers, artifact hygiene, implementation-entry/exit maintenance.
- Implementation techlead/engineer: active task status, implementation log, verification notes, execution brief.
- Review: findings, drift analysis, follow-up proposals.

If two member sessions need the same artifact, use dated sections with the shared epic mode and avoid broad rewrites. During implementation, non-driver members should not edit epic artifacts.

## State Updates

Use `.epic-loop/.runtime/session-bindings.json` as the source of truth for active epic membership. Historical or inactive sessions may remain recorded, but hooks should ignore them.

The epic runtime state is the source of truth for the shared mode and, during implementation, the exclusive `implementation_loop.driver_session_id`.

`state-of-epic.md` should reflect the latest known whole-epic state. Keep it concise and edit it carefully. It is acceptable for parallel sessions to add a short note rather than rewrite the entire file.

## When To Pause

Pause and ask the user when:

- two sessions need incompatible changes to active architecture
- implementation would proceed on assumptions review just invalidated
- reset would obsolete work currently being implemented
- a non-driver implementation member needs to modify epic artifacts
