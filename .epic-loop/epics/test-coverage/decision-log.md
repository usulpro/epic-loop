# Decision Log

## Active Decisions

- D-001: Separate deterministic unit tests from agent evals.
  - Status: active.
  - Motivation: Deterministic scripts and helpers should be proven quickly and reliably without LLM variance, while agent behavior needs fixture-based evals.
  - Tradeoff: This creates two validation layers, but keeps each layer honest about what it can prove.

- D-002: Use fixture projects as target-project eval surfaces.
  - Status: active.
  - Motivation: The skill operates inside target projects, so evals need realistic project roots, local validation commands, and multi-phase epic work.
  - Tradeoff: Fixtures add maintenance cost, but avoid testing only the plugin repository's own shape.

- D-003: Research Codex eval execution and tracing before locking the harness design.
  - Status: active.
  - Motivation: The eval runner should use supported Codex capabilities where possible and avoid depending on unstable transcript internals.
  - Tradeoff: Harness implementation waits for a short research step instead of committing to the first workable shell wrapper.

## Historical Decisions

- None recorded yet.
