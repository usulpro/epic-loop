# Epic Artifact Model

## Contents

- [Workspace](#workspace)
- [Required Files](#required-files)
- [Runtime Files](#runtime-files)
- [File Ownership Guidance](#file-ownership-guidance)
- [Compaction Contract](#compaction-contract)

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
- task kind: `implementation`, `verification`, `review`, `follow-up`, `architecture-reset`, `documentation-only`
- status: `todo`, `doing`, `need-review`, `blocked`, `partially-satisfied`, `deferred`, `reset-required`, `done`
- expected system outcome
- implementation surface
- acceptance criteria
- relevant docs

Every phase must include at least one task with kind `verification`.

- Default pattern: make the last task of the phase a phase-level verification task that checks the combined outcome of the preceding tasks.
- Stronger pattern: insert extra verification tasks immediately after risky or hard-to-observe tasks when the final phase check would be too indirect.

Verification-task contract:

- A `verification` task must not only say what should be verified. It must say exactly how that verification will happen.
- The task must name:
  - verification target: the concrete behavior, contract, state transition, artifact, or system outcome to prove
  - verification method: requests, browser automation, DB queries, log inspection, file/artifact inspection, diff comparison, external callback capture, or another explicit technique
  - tools and access path: Playwright, Chrome MCP, curl/httpie, project test runner, DB shell, admin panel, local scripts, auth/session bootstrap, required API keys, env vars, or local infra
  - environment/setup: which server, worker, seed data, auth state, queue, sandbox, or fixture must be running or prepared first
  - expected evidence: exact response shape, DOM state, screenshot, log line, generated file, DB row, emitted event, metric, or other artifact that proves the result
  - cleanup: how temporary instrumentation, debug logs, probes, fixtures, or generated artifacts will be removed after verification if they should not remain in the codebase or runtime
- Do not accept vague verification tasks such as `Verify API works` or `Check the UI manually`.

Reliable verification patterns to prefer:

- API and server handlers: send real HTTP requests or server-function calls through the target interface, handle auth/session/bootstrap explicitly, and assert on the returned payload, status code, side effects, and error cases.
- Browser UI: verify through Playwright or Chrome MCP with the intended auth state, user flow, and observable DOM/result evidence rather than static code inspection.
- Background jobs, sync, queues, or async workflows: verify through produced logs, DB state, output files, queue state, webhook captures, or other runtime artifacts.
- CLI, scripts, and generators: run the command, inspect stdout/stderr, exit code, and generated artifacts.
- Data migrations or persistence changes: verify with DB queries, schema inspection, and before/after state checks.
- Cross-system integrations: verify through an end-to-end path across the actual boundary whenever feasible, not only via mocked local helpers.

Temporary instrumentation is allowed when needed to make hidden behavior observable, for example adding short-lived console logs, file-based traces, or debug output. The verification task must say what temporary instrumentation will be added, what artifact it should reveal, and that the instrumentation must be removed or disabled again after the verification evidence is captured.

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

Documentation-scope rules:

- Prefer separate doc files for separate tasks when a task needs extra detail beyond the tracker entry.
- Do not merge unrelated task detail into one large catch-all document by default.
- Shared docs are appropriate when two or three closely related tasks work inside the same or nearly the same scope, share the same governing principles, or form an intentionally paired set such as implementation plus validation or testing.
- One task may reference multiple docs when that keeps each document focused, for example one shared principles doc plus one task-specific spec.
- Optimize for the smallest useful read scope per task. A task should not require reading large amounts of irrelevant detail just because it lives near another task.

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

Purpose: best-effort structured bookkeeping for deterministic phase/task scripts.

During implementation, `tracker.md` is the human-visible source of truth for task order and task intent. If this file disagrees with `tracker.md`, prefer `tracker.md`, record the drift if useful, and continue with the next visible task rather than stopping the loop solely for bookkeeping repair.

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

Use `.runtime/manager-reports.md` and `.runtime/manager-reports.jsonl` for final manager housekeeping messages captured from `Stop` hooks. `.runtime/latest-manager-report.md` is replaced on each manager stop so the next techlead turn can read the latest housekeeping outcome quickly.

Use `.epic-loop/.runtime/` for global hook events, session routing, and debug captures.

## File Ownership Guidance

Prefer append-only updates for logs and registers. Rewrite broad planning docs only in shaping, including when running the reset ladder, and preserve historical context when old decisions might explain existing code.

## Compaction Contract

Compaction exists to preserve fast re-entry for active work, not to tidy files cosmetically.

Compaction trigger:

- Consider compaction when a key human-facing non-doc artifact grows beyond roughly 500 lines and the inactive historical layer is making current work harder to read.

Only the manager role may compact epic artifacts, and only during a housekeeping pass.

Artifacts that may be compacted:

- `tracker.md`
- `implementation-log.md`
- `decision-log.md`
- `risk-register.md`

Artifacts that must not be compacted:

- `docs/**`
- active task or phase specs still needed for near-term work
- `state-of-epic.md`, which should stay concise by direct editing rather than archival layering

Active-layer rule:

- Compact only sections that are no longer active in the current epic state.
- Closed phases in `tracker.md` may be compacted.
- Historical decisions tied only to closed work may be compacted.
- Historical implementation-log runs tied to closed work may be compacted.
- Resolved risks tied only to closed work may be compacted.
- Do not compact anything still needed for the active phase, active task, next verification step, or near-term implementation decisions.

Archive-file naming:

- Move compacted content into a sibling file with a `previous-layer` suffix.
- Preferred examples:
  - `tracker.previous-layer-01.md`
  - `decision-log.previous-layer-01.md`
  - `implementation-log.previous-layer-01.md`
  - `risk-register.previous-layer-01.md`
- If a phase- or topic-specific archive is clearer, that is allowed:
  - `tracker.phase-1.previous-layer-01.md`
  - `decision-log.auth.previous-layer-01.md`

Stub rule:

- Replace the moved section with a short stub in the original file.
- The stub must point to the archive file and say that it should be read only if needed.
- Example shape:

```text
Archived to `tracker.phase-1.previous-layer-01.md`.
Read only if you need historical closure context for this phase.
```

Documentation rule:

- Do not compact `docs/**`. Epic docs are treated as atomic references rather than gradually compacted working layers.
