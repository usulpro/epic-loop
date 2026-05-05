# Review Mode

## Goal

Review mode verifies that the implementation matches the original intent of the epic, not only the current documentation.

The central question is:

```text
Did we build what we actually wanted at the beginning?
```

## Inputs

Use:

- original conversation context available in the current session
- `state-of-epic.md`
- tracker
- docs
- decision log
- implementation log
- code and verification results
- user corrections, frustrations, or emphasis from the discussion

If the original conversation context is unavailable, state that limitation and review against the best preserved intent in epic artifacts.

## Process

1. Reconstruct original intent:
   - user goals
   - priorities
   - non-negotiables
   - implicit product or engineering meaning
   - what was considered central vs secondary

2. Compare intent to documentation:
   - what was captured well
   - what was lost
   - what was simplified or distorted
   - what became stale

3. Compare documentation to implementation:
   - what matches
   - what diverges
   - what is only partially satisfied

4. Compare implementation to original intent:
   - over-literal implementation
   - missing product meaning
   - architecture drift
   - forgotten constraints
   - verification gaps

5. Produce outcomes:
   - confirm alignment
   - create follow-up tasks
   - update docs
   - update decision log or risks
   - return to shaping or implementation

## Non-Goals

Do not reduce this mode to local code review. Do not focus on micro-findings unless they affect the epic intent. The techlead submode handles local closure review; review mode handles global meaning.

## Findings Format

Lead with the highest-impact drift or confirmation. For each finding include:

- intent
- current implementation/doc state
- gap
- recommended next artifact or task
