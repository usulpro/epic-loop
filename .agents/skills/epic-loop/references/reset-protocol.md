# Architecture Reset Protocol

## Reset Ladder

Do not jump straight to reset when the current path becomes uncomfortable.

Choose the smallest honest escalation:

1. `local correction`
   - the path is still right
   - fix a concrete defect, omission, or weak proof

2. `tactical detour`
   - the phase intent still stands
   - the implementation path should change
   - the epic does not need a full reframe

3. `strategic reset`
   - the active architecture, roadmap, task framing, or assumptions are no longer a reliable guide

## When To Reset

Use strategic reset when the current architecture, roadmap, or task model is no longer a reliable guide.

Signals:

- a core assumption is invalid
- old docs now mislead implementation
- roadmap order no longer fits reality
- phase/task framing fights the desired architecture
- implementation repeatedly discovers the same structural mismatch
- a workaround would silently replace the active architecture
- tracker and implementation truth can no longer be repaired with local corrections alone

Do not reset:

- just because the path is annoying
- just because one task is harder than expected
- when a local correction or tactical detour would preserve the same phase intent honestly

## Protocol

1. Stop linear execution.
2. Record the reset trigger in `implementation-log.md` or a reset note.
3. Add a decision-log entry explaining:
   - what changed
   - why old assumptions are no longer binding
   - what remains valid
   - what becomes historical
4. Mark stale tracker items:
   - `reset-required`
   - `deferred`
   - `historical`
   - or move them under a historical section
5. Rewrite or create the active plan:
   - current framing
   - new phases
   - immediate next tasks
   - verification expectations
6. Update `state-of-epic.md` so a new session cannot accidentally resume the stale path.
7. Resume in shaping or implementation.

## Historical Baseline

Do not delete old context blindly. Preserve enough history to explain:

- why old code or docs exist
- why a decision was superseded
- what risks came from the reset

The active plan must be clearly marked so future sessions know what is binding.
