# Architecture Reset Protocol

## When To Reset

Use reset when the current architecture, roadmap, or task model is no longer a reliable guide.

Signals:

- core assumption is invalid
- old docs now mislead implementation
- roadmap order no longer fits reality
- phase/task framing fights the desired architecture
- implementation repeatedly discovers the same structural mismatch

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
