# Implementation Techlead / Engineer Cycle

## Core Rule

Implementation alternates between:

- `techlead`: tactical orchestration
- `engineer`: tactical execution

One active implementation session is in exactly one submode at a time.

A slug-only resume is not permission to start implementation. The agent must read the epic state, report readiness, and wait for explicit confirmation before running the first techlead turn in that session.

## Techlead Turn

Before the first techlead turn in a newly resumed session, activate that session for hook routing:

```bash
node .agents/skills/epic-loop/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

If another session was previously active for the same epic and mode, this binding replaces it.

The techlead must:

1. Check previous task closure:
   - code complete
   - verification performed or explicitly deferred
   - tracker/log updated
   - blockers recorded

2. Select the next actionable task:
   - use tracker and active phase
   - skip blocked tasks after recording why
   - do not close milestone gates dishonestly

3. Understand task intent:
   - desired outcome
   - boundaries
   - relevant docs
   - accepted decisions
   - expected code/runtime/contract change

4. Reject accidental documentation-only ambiguity:
   - name implementation surface
   - name expected system outcome
   - name acceptance criteria beyond "docs updated"

5. Gather code context:
   - relevant directories
   - nearby tests
   - project constraints
   - verification tools

6. Produce an execution brief:
   - task
   - intent
   - docs
   - code context
   - constraints
   - required verification

The brief should be short enough to act on. Use `execution-brief.md` or `prompt.md` only when useful.

## Engineer Turn

The engineer must:

1. Execute the brief.
2. Use existing project patterns.
3. Verify at the appropriate level.
4. Update artifacts that changed:
   - tracker
   - implementation log
   - decision log
   - risk register
   - state summary
5. Return blockers, mismatches, or architecture drift to techlead.

The engineer may make local implementation decisions, but should not silently redesign the epic or ignore the brief.

## Exit Conditions

Leave the implementation cycle when:

- a design assumption is invalid and needs shaping
- the roadmap is stale and needs reset
- the completed slice needs intent-level review
- verification cannot proceed without external decision
- the active phase is complete and needs milestone closure

## Closure Discipline

A task is not done because code was edited. It is done when:

- behavior or contract changed as expected
- required verification ran or the gap is recorded
- docs/logs/tracker reflect reality
- blockers and risks are not hidden

Use commits when the project workflow expects them. If commits are not appropriate, still record exact changed areas and verification.
