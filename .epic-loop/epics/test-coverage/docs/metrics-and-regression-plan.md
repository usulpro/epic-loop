# Metrics And Regression Plan

## Intent

Define how eval runs are judged, store baseline results, and make future regressions visible through local and pipeline checks.

## Candidate Metrics

- Epic artifact completeness: required files exist and contain task-specific content.
- Lifecycle discipline: shaping, implementation, role handoff, and verification behavior follow the skill contract.
- Task completion: expected code/docs changes appear in the fixture project.
- Verification quality: fixture validation commands were run and evidence is present.
- Trace completeness: prompts, role transitions, result summaries, and cleanup status are captured.
- Regression severity: failures are classified as blocking, warning, or report-only.

## Pipeline Direction

- Unit tests should be a hard gate.
- Fast eval checks should be eligible for regular regression runs.
- Expensive or high-variance evals may run on demand or scheduled until their stability is proven.
- Raw traces should remain ignored; committed summaries should be compact and comparable.

## Baseline Result Requirements

Each baseline run should record:

- fixture name and scenario;
- command and environment assumptions;
- score by metric;
- failures and known variance;
- trace reference;
- cleanup confirmation.

## Verification Evidence

The final verification should prove the pipeline fails on a controlled regression, then passes after the temporary breakage is removed.
