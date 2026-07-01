# Risk Register

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| Unit tests overfit generated prose instead of deterministic behavior. | Brittle tests block harmless doc wording changes. | Keep assertions on CLI contracts, state files, parsed JSON, status transitions, and generated artifact existence/shape; avoid prose snapshots unless the prose is a contract. | open |
| Agent evals are too flaky for regression gating. | Pipeline may fail for model variance rather than product regressions. | Separate hard gates from report-only metrics; record variance; use deterministic fixture validation and focused scoring. | open |
| Codex automation/tracing interfaces are unstable or undocumented. | Eval runner could become fragile or hard to maintain. | Research official/local Codex capabilities first, keep raw traces ignored, and normalize committed summaries through a small stable schema. | open |
| Fixture projects drift from real epic-loop usage. | Evals give false confidence. | Make scenarios multi-phase, require verification tasks, and include realistic target-project constraints and cleanup behavior. | open |
| Raw traces or runtime state get committed accidentally. | Repo noise or sensitive data leakage. | Store raw traces in ignored runtime output; add validation checks for `.epic-loop/.runtime`, hook captures, and prompt logs. | open |
