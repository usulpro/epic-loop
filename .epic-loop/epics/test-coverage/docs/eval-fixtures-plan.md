# Eval Fixtures Plan

## Intent

Create three fixture target projects that can run realistic `epic-loop` agent evals with multi-phase work, local validation, and clean teardown.

## Fixture Requirements

Each fixture project should include:

- a small but real project structure;
- a deterministic validation command;
- a multi-phase epic scenario written in English;
- acceptance criteria and verification tasks;
- expected evidence for the evaluator;
- cleanup guidance for `.epic-loop/`, temp output, and raw traces.

## Candidate Fixture Shapes

- Node CLI/library project with script changes, tests, and docs.
- React or frontend fixture with component behavior, styling constraints, and browser-level verification.
- Mixed workflow fixture with config migration, generated artifacts, and validation scripts.

The implementation may adjust these shapes after inspecting the repo and eval harness constraints, but it should preserve three meaningfully different skill-use scenarios.

## Scenario Requirements

Each scenario must contain at least:

- three phases;
- implementation tasks with concrete surfaces;
- one verification task per phase;
- expected final state;
- evaluator-facing success criteria.

## Verification Evidence

The phase-level verification should run every fixture from a clean temp copy and record command output, generated summary paths, and cleanup confirmation.
