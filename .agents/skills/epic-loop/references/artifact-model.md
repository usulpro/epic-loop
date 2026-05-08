# Epic Artifact Model

## Workspace

Store each epic under:

```text
.epic-loop/epics/{epic-slug}/
```

Human-facing epic artifacts live under `.epic-loop/epics/{epic-slug}/`. Runtime and debug artifacts live under hidden `.runtime` folders:

```text
.epic-loop/
  epics/{epic-slug}/
    state-of-epic.md
    tracker.md
    implementation-log.md
    decision-log.md
    risk-register.md
    docs/
    .runtime/
      runtime-state.json
      roadmap-state.json
      prompt-log.jsonl
      progress-log.jsonl
      latest-engineer-report.md
  .runtime/
    hook-events/{session_id}/...
    sessions/{session_id}.json
    session-bindings.json
```

This keeps role-facing truth separate from framework execution traces.

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

Purpose: human-readable roadmap projection.

Track:

- phases and tasks
- task labels like `T3.2` where the first number is the phase number and the second number is the task number within that phase
- a short task title in brackets on the task line
- task kind: `implementation`, `verification`, `review`, `follow-up`, `architecture-reset`, `documentation-only`
- status: `todo`, `doing`, `need-review`, `blocked`, `partially-satisfied`, `deferred`, `reset-required`, `done`
- expected system outcome
- implementation surface
- acceptance criteria
- relevant docs

Task lines should start like:

```text
- [ ] T3.2 [Short Title]
Kind: follow-up | Status: todo
```

For `need-review` tasks, the checkbox is the review state:

```text
- [ ] T3.2 [Short Title]
Kind: review | Status: need-review

- [x] T3.2 [Short Title]
Kind: review | Status: need-review
```

Use `need-review` only for tasks that were already `done` and now need another verification pass because of new evidence, an external blocker clearing, or a user-requested recheck.
For `need-review` tasks, the checkbox is the review state: `[ ]` means the recheck is pending, `[x]` means the recheck has been completed. The task status remains `need-review` either way.

`tracker.md` is rendered from `.runtime/roadmap-state.json`. Use task and phase scripts for mechanical status changes.

### `implementation-log.md`

Purpose: chronological execution trace.

Append dated entries through `append-implementation-log.mjs` for:

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

Readable docs that may enter session context should stay under 900 lines per file. If a doc grows beyond that limit, split it into smaller parts and add a short cross-reference or index file so the agent can navigate the pack without loading one oversized document. This rule does not apply to hidden runtime/debug files or other technical artifacts that never enter normal session context.

Use the checker after updating docs:

```bash
node .agents/skills/epic-loop/scripts/check-epic-artifact-limits.mjs --slug "<epic-slug>"
```

### `.runtime/runtime-state.json`

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

### `.runtime/roadmap-state.json`

Purpose: structured source of truth for deterministic phase/task mutations.

Track:

- phase ids and task ids
- task status
- active phase and active task
- follow-up tasks
- rendered tracker projection state

## Runtime Files

Use `.runtime/current-engineer-prompt.md` only as the active engineer handoff file. Create it with `write-engineer-brief.mjs`.

Use `.runtime/progress-log.md` as the append-only human-readable mirror of `.runtime/progress-log.jsonl`. Use `.runtime/progress-report.md` for regenerated aggregate timing and grouping.

Use `.runtime/engineer-reports.md` and `.runtime/engineer-reports.jsonl` for final engineer messages captured from `Stop` hooks. `.runtime/latest-engineer-report.md` is replaced on each engineer stop so the next techlead turn can read the latest factual report quickly.

Use `.epic-loop/.runtime/` for global hook events, session routing, and debug captures.

## File Ownership Guidance

Prefer append-only updates for logs and registers. Rewrite broad planning docs only in shaping or reset mode, and preserve historical context when old decisions might explain existing code.
