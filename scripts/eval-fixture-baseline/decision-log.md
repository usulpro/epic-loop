# Decision Log

## Active Decisions

- 2026-07-02: Use an isolated `temp/eval-fixture-project` mini-project as the eval surface.
  - Motivation: The eval should exercise real file creation, test writing, verification, task status transitions, nested repo commits, and final inspectable output without changing plugin behavior.
  - Rejected alternatives: modifying plugin scripts directly; creating a package-level fixture with dependency changes; using only documentation tasks.
  - Status: active.

- 2026-07-02: Initialize `temp/eval-fixture-project` as a nested git repository.
  - Motivation: The root repository intentionally ignores `temp/`, but implementation mode still needs honest task-owned commits. A nested repo preserves commit discipline without polluting the root project history.
  - Rejected alternatives: unignoring the fixture in the root repo; allowing a no-commit exception for ignored fixture files.
  - Status: active.

- 2026-07-02: Use .mjs modules plus built-in `node:test`.
  - Motivation: This keeps implementation deterministic, dependency-free, and easy for multiple agents to run.
  - Rejected alternatives: adding Jest/Vitest dependencies; creating a separate package manager workspace under the fixture folder.
  - Status: active.

- 2026-07-02: Keep the fixture project after successful implementation.
  - Motivation: Eval runs should leave the completed mini-project available for inspection after the loop finishes.
  - Rejected alternatives: deleting the fixture as the final implementation task.
  - Status: active.

- 2026-07-02: Reset the eval through `npm run eval-fixture-reset`.
  - Motivation: Reset should be explicit, repeatable, and independent from the implementation roadmap being evaluated.
  - Rejected alternatives: relying on manual cleanup; adding cleanup back as a final epic task.
  - Status: active.

## Historical Decisions

- None recorded.
