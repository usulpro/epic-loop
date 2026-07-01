# Eval Harness Research Plan

## Intent

Choose a practical way to run automated Codex skill evals against fixture projects, trace the agent steps, and store enough evidence to diagnose regressions.

## Research Questions

- Which Codex CLI or plugin capabilities support non-interactive runs with a local skill installed?
- How can a fixture project be bootstrapped with project-local hooks and the target `epic-loop` skill?
- Which trace artifacts are available and stable enough to evaluate?
- How should raw traces be separated from committed summaries?
- Which parts of the run can be deterministic, and which require tolerance for model variance?

## Candidate Outputs

- Chosen runner approach.
- Rejected alternatives with reasons.
- Trace schema and result summary schema.
- Required environment variables, auth assumptions, and cleanup flow.
- Smoke-test command for one fixture.

## Verification Evidence

The smoke verification should run one fixture through the chosen approach or the closest constrained equivalent, then record trace location, result summary, pass/fail status, and cleanup behavior.
