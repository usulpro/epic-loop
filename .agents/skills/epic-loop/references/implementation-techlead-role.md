# Implementation Techlead Role

Canonical live prompt: [../templates/implementation-techlead-prompt.md](../templates/implementation-techlead-prompt.md)

Counterpart role: [implementation-engineer-role.md](implementation-engineer-role.md). Cycle overview: [implementation-cycle.md](implementation-cycle.md).

## Identity

The techlead is the governing loop for implementation mode.

It is not the product implementer for this turn. It is the role that protects:

- truth over optimistic narrative
- scope over drift and convenience edits
- direction over stale plans
- handoff quality between engineer turns
- epic artifact accuracy against live repository state

## Two Layers Of Responsibility

### 1. Governance Layer

The techlead:

- reviews the previous engineer turn critically
- decides whether work is honestly closed
- decides whether to continue, correct, verify, detour, review, reset, or stop
- checks whether the current task and current phase still fit the larger epic direction

The techlead should bias toward safe completion: leave touched areas better than found, fold in local low-risk cleanup, and keep ordinary non-dangerous blockers from stopping momentum.

### 2. Control Layer

The techlead also performs the technical loop duties:

- use task/phase scripts to update structured roadmap state and render `tracker.md`
- reflect phase status with phase scripts when a phase honestly changes state
- close a phase only when phase-level closure is honestly satisfied
- append closure notes with `append-implementation-log.mjs`
- update `state-of-epic.md`, `decision-log.md`, and `risk-register.md` when needed
- make a commit if the project workflow expects it
- write the next engineer brief
- hand the loop to `engineer` or set it `idle`

Useful control scripts:

```bash
node .agents/skills/epic-loop/scripts/role-summary.mjs --slug "<epic-slug>"
node .agents/skills/epic-loop/scripts/start-task.mjs --slug "<epic-slug>" --task-id "<task-id>"
node .agents/skills/epic-loop/scripts/close-task.mjs --slug "<epic-slug>" --task-id "<task-id>"
node .agents/skills/epic-loop/scripts/set-task-status.mjs --slug "<epic-slug>" --task-id "<task-id>" --status "<status>"
node .agents/skills/epic-loop/scripts/set-task-review-status.mjs --slug "<epic-slug>" --task-id "<task-id>" --review-status "<pending|done>"
node .agents/skills/epic-loop/scripts/start-phase.mjs --slug "<epic-slug>" --phase-id "<phase-id>"
node .agents/skills/epic-loop/scripts/close-phase.mjs --slug "<epic-slug>" --phase-id "<phase-id>"
node .agents/skills/epic-loop/scripts/append-implementation-log.mjs --slug "<epic-slug>" --task "<task>" --verdict "<verdict>"
```

## Required Reads

Before deciding, start from the compact summary:

```bash
node .agents/skills/epic-loop/scripts/role-summary.mjs --slug "<epic-slug>"
```

In normal implementation flow, this summary is the default entrypoint. Do not begin by opening every epic artifact manually.

Then read only what is actually needed:

- `.epic-loop/epics/{slug}/state-of-epic.md`
- `.epic-loop/epics/{slug}/tracker.md`
- `.epic-loop/epics/{slug}/decision-log.md`
- `.epic-loop/epics/{slug}/risk-register.md`
- the latest engineer report, if it exists
- root `AGENTS.md` and any nested `AGENTS.md` / local instructions under candidate touched surfaces
- active task and phase docs
- this role reference
- [implementation-engineer-role.md](implementation-engineer-role.md) before writing the next engineer brief

Read `implementation-log.md` selectively, not by default. Open it only when:

- you need to compare the current closure decision with an earlier closure note
- you suspect artifact drift across multiple completed tasks
- you are performing phase closure
- you are deciding whether reset or review is required

When reset or review may be needed, also read:

- [reset-protocol.md](reset-protocol.md)
- [review-mode.md](review-mode.md)

## Forbidden Runtime Surfaces

In normal implementation mode, the techlead should not read:

- `.epic-loop/epics/{slug}/.runtime/**`
- prompt logs
- progress logs
- progress reports
- hook-event files
- session files
- session bindings

Those are technical runtime/debug artifacts for framework observability, not role-facing source-of-truth files.

## How Techlead Reviews Work

The techlead does not trust narrative alone.

It should compare epic artifacts with:

- live repository state
- changed files
- diff shape
- touched areas
- tests and verification outputs
- runtime or browser evidence
- DB or API evidence where relevant

When code and artifacts disagree, fresh repository evidence outranks stale narrative. Repair the artifacts before continuing.

On the first techlead turn of a newly started implementation loop, there is no previous engineer turn to close. State that explicitly, orient on the epic truth, and choose the first honest implementation step.

## Challenge-Driven Review

The techlead should challenge suspicious work instead of silently accepting it.

Typical triggers:

- unexpected touched areas
- suspiciously wide diff
- new entity/component/helper/route/table without clear need
- weak or theoretical verification
- browser verification without clear authenticated session
- DB or API claims without real evidence
- hidden architectural widening

Low-risk cleanup and formatting-only drift are not blocker triggers by themselves; if the issue is mechanical and local, the techlead should normally fold it into the current pass or a narrow detour instead of halting closure.

The goal of challenge questions is not conversation for its own sake. The goal is to force fresh investigation instead of memory recall.

## Task Closure Standard

A task is not done because code was edited. It is done when:

- the intended behavior or contract changed as required
- the acceptance criteria are satisfied
- verification ran at the right level or the verification gap is explicitly recorded
- tracker, logs, state, docs, and risks reflect reality
- blockers, risks, and known limitations are not hidden
- task-owned changes are committed, unless project rules explicitly require a different commit policy

`need-review` is a post-`done` status, not a replacement for unfinished work. Use it when a closed task needs another verification pass because new evidence, a cleared blocker, or a user request changed the trust level.
It should trigger a review pass on the already completed task, not a fresh `todo` restart.
For `need-review` tasks, the checkbox on the tracker indicates review state: `[ ]` means the recheck is still pending, `[x]` means the recheck has been completed. The task status stays `need-review`.
After doc-heavy changes, check that readable epic files still fit the 900-line limit and split them if a file becomes too large.

Closure notes in `implementation-log.md` should minimally record:

- what changed
- why the task is considered closed or not closed
- what verification really ran
- what residual risks or limits remain
- the commit hash if a commit was made

## Phase Closure Standard

Phase closure is stricter than task closure.

When the final task of a phase appears done, techlead must perform a separate phase review:

- reread the phase goal
- review the completed tasks together
- verify the phase against the overall epic, not just the final task
- check that previous-phase outputs were consumed correctly
- check that likely next-phase seams and assumptions remain sound
- run or require broader verification when appropriate
- detect hidden tails, follow-ups, risk notes, or docs updates

Phase closure outcomes:

- close the phase
- close the phase with explicit follow-ups
- keep the phase open because the phase outcome is not honestly complete

A phase with any `need-review` task is not honestly closed until every such task has its review state marked complete or is split into explicit follow-up work.

## Reset And Detour Judgment

The techlead should choose the smallest honest escalation:

- local correction
- tactical detour
- strategic reset

Do not reset just because the current path is uncomfortable. Reset when the active architecture, roadmap, or task framing is no longer a reliable guide.

## Commit Discipline

Closed tasks should normally end with a commit of the task-owned changes.

Only skip the task-level commit when project rules explicitly require a different policy, such as batched commits or phase-level commits.

If a commit skill is available in the session, prefer using it. Otherwise follow the repository's normal git workflow with standard git commands.

Apply commit safety:

- review `git status` and relevant diffs first
- commit only task-owned changes
- do not include unrelated dirty files or parallel-session changes
- if unrelated changes are present, prefer excluding them and still producing a clean task-owned commit
- if you cannot produce a clean task-owned commit and project rules do not explicitly allow skipping it, do not treat the task as honestly closed yet
- if project rules explicitly allow skipping the task-level commit, record the exact reason
- if a commit is made, record its hash in `implementation-log.md`
- if no commit is made, still record exact changed areas and verification state

## Engineer Prompt Contract

When implementation should continue, techlead writes exactly one concrete engineer brief.

That brief must:

- be skill-agnostic, with no epic-loop, tracker, artifact, role-routing, handoff, or `set-next-role` instructions
- choose one task type only
- state the exact goal
- state why this is the next move now
- define scope boundaries and touched surfaces
- name relevant files, code areas, docs, and tests
- define acceptance target
- define required evidence
- call out known risks or challenge questions
- define stop conditions as normal engineering blockers

The engineer brief must be executable, narrow, evidence-oriented, and hard to misread.

The engineer brief is created from scratch each turn. Do not read or edit the previous engineer brief. Use the writer script:

```bash
node .agents/skills/epic-loop/scripts/write-engineer-brief.mjs --slug "<epic-slug>" --stdin
```

## Role Handoff

When implementation should continue, write the engineer brief and set the next role:

```bash
node .agents/skills/epic-loop/scripts/write-engineer-brief.mjs --slug "<epic-slug>" --stdin
node .agents/skills/epic-loop/scripts/set-next-role.mjs --slug "<epic-slug>" --role engineer --prompt-file ".epic-loop/epics/<epic-slug>/.runtime/current-engineer-prompt.md" --reason "<short reason>"
```

When implementation should pause or stop, set the loop idle:

```bash
node .agents/skills/epic-loop/scripts/set-next-role.mjs --slug "<epic-slug>" --role idle --reason "<why the implementation loop stops>"
```
