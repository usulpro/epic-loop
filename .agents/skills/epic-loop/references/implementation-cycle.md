# Implementation Techlead / Engineer Cycle

## Core Rule

Implementation alternates between:

- `techlead`: governance, closure, direction, and handoff
- `engineer`: execution of one concrete brief

One active implementation session is in exactly one submode at a time.

A slug-only resume is not permission to start implementation. The agent must read the epic state, report readiness, and wait for explicit confirmation before running the first techlead turn in that session.

## Canonical Runtime Behavior

The live role prompt is the canonical runtime contract for the active role.

- Techlead live prompt: [../templates/implementation-techlead-prompt.md](../templates/implementation-techlead-prompt.md)

The reference files below support and deepen the runtime prompt, but they do not override it.

## Role References

- Techlead role: [implementation-techlead-role.md](implementation-techlead-role.md)
- Engineer role: [implementation-engineer-role.md](implementation-engineer-role.md)

The techlead may read both role references to manage the loop and write task briefs. Engineer-facing prompts remain skill-agnostic and do not ask the engineer to read role references.

## Cycle Entry

Before the first techlead turn in a newly resumed session, activate that session for hook routing:

```bash
node .agents/skills/epic-loop/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

If another session was previously active for the same epic and mode, this binding replaces it.

Binding starts the loop with `next_role: techlead`. The current user turn should stop after binding; the `Stop` hook continues the same session with the first techlead prompt.

Implementation observability is permanent. Each continuation prompt is appended to `execution/prompt-log.md` and `execution/prompt-log.jsonl`. Lifecycle events are appended to `execution/progress-log.jsonl` and readable `execution/progress-log.md`; `execution/progress-report.md` is regenerated from the structured event log and groups completed turns by phase, task, and role.

## Turn Order

1. The user confirms implementation in the current session.
2. The agent binds the current session to the epic and implementation mode.
3. The next `Stop` hook emits the first techlead prompt.
4. The techlead inspects epic state and live repository evidence, then decides whether to close work, continue, pause, review, detour, or reset.
5. If implementation should continue, techlead writes exactly one concrete, skill-agnostic engineer prompt and sets the next role to `engineer`.
6. The hook starts one engineer turn and immediately pre-sets the following role to `techlead`.
7. The engineer executes that prompt, verifies the slice, reports the factual outcome, and stops.
8. The `Stop` hook captures the engineer final message, stores it as the latest engineer report, and automatically starts the next techlead turn.
9. The cycle repeats until techlead exits to review, shaping, reset, blocker handling, or idle.

If the user interrupts a running implementation turn, a later `UserPromptSubmit` in the same bound session marks that open turn as `turn-interrupted`, sets the loop status to `interrupted`, and prevents silent auto-continuation. If implementation is restarted while an older open turn exists, the old turn is closed as interrupted without inventing active duration.

On the first techlead turn in a newly started implementation loop, there is no previous engineer turn to close. In that case, techlead should say so explicitly, orient on epic state, and choose the first honest implementation step.

## Techlead Turn Expectations

The techlead is not just a planner. It is the governing loop for:

- truth over optimistic narrative
- scope over drift and convenience edits
- direction over stale plans
- handoff quality between turns
- artifact accuracy against the real repository state

The techlead must:

1. Re-ground on epic and phase context.
2. Inspect live repository evidence rather than trusting artifacts alone.
3. Review the previous engineer turn as an adversarial owner.
4. Ask pointed challenge questions when the work is suspicious, incomplete, or weakly verified.
5. Decide task closure honestly.
6. Execute the technical control duties:
   - update `tracker.md`
   - reflect phase status in `tracker.md` when a phase honestly changes state
   - update `implementation-log.md`
   - update `state-of-epic.md`
   - update `decision-log.md` and `risk-register.md` when needed
   - make a commit if the workflow expects it
7. Apply stricter standards to phase closure than task closure.
8. Choose the next move:
   - close and continue
   - corrective pass
   - investigation pass
   - verification pass
   - tactical detour
   - review
   - reset
   - idle/stop
9. Write exactly one high-quality engineer prompt when implementation continues.

## Engineer Turn Expectations

The engineer owns one concrete task brief and does not know about epic-loop runtime mechanics.

The engineer may be asked to run one of these task types:

- implementation slice
- investigation pass
- correction pass
- verification pass
- tactical detour pass

The engineer must:

1. Execute only the requested slice.
2. Follow existing project patterns and constraints.
3. Bring back real evidence rather than optimistic summaries.
4. Report changed files, implemented behavior, verification results, blockers, gaps, or follow-up notes.
5. Stop after the report. Routing returns to techlead automatically.

## Closure Discipline

A task is not done because code was edited. It is done when:

- the intended behavior or contract changed as required
- the acceptance criteria are satisfied
- verification ran at the right level or the verification gap is explicitly recorded
- epic artifacts reflect reality
- blockers, risks, and known limitations are not hidden

Closure notes in `implementation-log.md` should minimally record:

- what changed
- why the task is considered closed or not closed
- what verification really ran
- what residual risks or limits remain
- the commit hash if a commit was made

## Phase Closure Discipline

Closing the final task of a phase does not automatically close the phase.

Phase closure requires an additional integrative review:

- reread the phase goal
- review the tasks together, not in isolation
- check that the phase consumes previous-phase outputs correctly
- check that the phase integrates cleanly with the existing system
- check that the phase creates adequate seams and assumptions for likely next phases
- run or require broader verification when appropriate
- detect hidden tails, missing surfaced states, docs drift, and follow-up work

Acceptable phase outcomes are:

- close the phase
- close the phase with explicit follow-ups
- keep the phase open because the outcome is not honestly complete

## Reset Ladder

When the current path becomes questionable, techlead should choose the smallest honest escalation:

- `local correction`
- `tactical detour`
- `strategic reset`

Use reset when the active architecture, roadmap, or task framing is no longer a reliable guide. Do not reset too early, but do not keep executing a stale path once structural mismatch is evident.

## Exit Conditions

Leave the implementation cycle when:

- a design assumption is invalid and needs shaping
- the roadmap is stale and needs reset
- the completed slice needs intent-level review
- verification cannot proceed without external decision
- the active phase is complete and needs milestone closure

## Prompt-Writing Rule

When techlead writes the next engineer prompt, it must be:

- skill-agnostic, with no epic-loop, tracker, artifact, role-routing, handoff, or `set-next-role` instructions
- narrow enough to execute safely
- explicit about scope boundaries
- explicit about acceptance
- explicit about required evidence
- explicit about stop conditions and escalation triggers

“Continue implementation” is not a valid engineer prompt.

## Commit Safety

If the project workflow expects commits, techlead should still apply commit discipline:

- review `git status` and relevant diffs first
- commit only task-owned changes
- never sweep unrelated dirty files into the task commit
- if unrelated changes from parallel work are present, exclude them from the commit or skip the commit and record why
- if a commit is made, record the commit hash in `implementation-log.md`
- if a commit is not made, still record the exact changed areas and verification state
