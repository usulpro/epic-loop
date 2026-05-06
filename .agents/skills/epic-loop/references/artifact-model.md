# Epic Artifact Model

## Workspace

Store each epic under:

```text
.epic-loop/epics/{epic-slug}/
```

All mutable epic-loop project state lives under one ignored directory:

```text
.epic-loop/
  epics/{epic-slug}/
  hook-events/{session_id}/...
  sessions/{session_id}.json
  session-bindings.json
```

This keeps epic artifacts, hook events, session bindings, and per-session routing out of the visible project root.

## Required Files

### `state-of-epic.md`

Purpose: fast re-entry.

Keep it short:

- epic title and slug
- current lifecycle mode
- active phase
- current task
- last meaningful progress
- active blockers
- next intended action
- important re-entry notes

### `tracker.md`

Purpose: execution source of truth.

Track:

- phases and tasks
- task kind: `implementation`, `verification`, `review`, `follow-up`, `architecture-reset`, `documentation-only`
- status: `todo`, `doing`, `blocked`, `partially-satisfied`, `deferred`, `reset-required`, `done`
- expected system outcome
- implementation surface
- acceptance criteria
- relevant docs

### `implementation-log.md`

Purpose: chronological execution trace.

Append dated entries for:

- task started/completed
- code changes
- verification commands and results
- commits
- blockers and workarounds
- milestone closure notes

### `decision-log.md`

Purpose: architectural memory.

Record:

- accepted decisions
- motivation
- rejected alternatives
- tradeoffs
- unresolved design questions
- whether the decision is active or historical

### `risk-register.md`

Purpose: durable concern tracking.

Record:

- risk
- impact
- likelihood if known
- mitigation
- current status
- linked tasks or docs

### `docs/problem-framing.md`

Purpose: initial shaping source of truth.

Capture:

- intent
- desired outcome
- scope and non-scope
- constraints
- open questions
- known implementation surface

### `docs/`

Purpose: evolving documentation pack.

Create only documents that help the epic:

- architecture
- contracts
- migration or rollout
- verification plan
- operations or support notes

### `runtime-state.json`

Purpose: lightweight coordination state.

Useful keys:

```json
{
  "slug": "example-epic",
  "mode": "shaping",
  "active_phase": null,
  "active_task": null,
  "implementation_submode": "techlead",
  "execution_brief": null,
  "updated_at": "2026-05-05T00:00:00Z"
}
```

## Optional Files

Use `execution-brief.md` or `prompt.md` only when task handoff needs a file artifact. It should be short, task-specific, and safe to replace after the task is done.

Use `execution/progress-log.md` as the append-only human-readable mirror of `execution/progress-log.jsonl`. Use `execution/progress-report.md` for regenerated aggregate timing and grouping.

## File Ownership Guidance

Prefer append-only updates for logs and registers. Rewrite broad planning docs only in shaping or reset mode, and preserve historical context when old decisions might explain existing code.
