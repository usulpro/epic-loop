# Tracker

Epic: Test Coverage And Eval Pipeline For The Epic-loop

## Task Statuses

- todo
- doing
- need-review
- blocked
- partially-satisfied
- deferred
- reset-required
- done

## Task Kinds

- implementation
- verification
- review
- follow-up
- architecture-reset
- documentation-only

## Active Roadmap

### Phase 1: Deterministic Unit Test Foundation

- Phase status: doing

- [x] Kind: implementation | Status: done | Map deterministic engine surfaces and configure the unit test harness.
  - Outcome: The repo can run focused unit tests for deterministic epic-loop behavior.
  - Surface: `package.json`, existing test config or new minimal test config, `plugins/epic-loop/skills/epic-loop/scripts/**`, test utilities.
  - Acceptance: A documented test command runs locally; the selected framework can import the script helper modules and execute CLI-level tests without requiring Codex hooks or live LLM calls.
  - Docs: `docs/unit-test-plan.md`.

- [x] Kind: implementation | Status: done | Cover core helper functions and state transitions.
  - Outcome: Engine primitives have tests for normal paths and meaningful edge cases.
  - Surface: Helper modules under `plugins/epic-loop/skills/epic-loop/scripts/lib/**`, runtime state readers/writers, tracker rendering, roadmap state handling.
  - Acceptance: Tests prove stable behavior for state creation, reads, updates, rendering, invalid input handling, and idempotent operations where applicable.
  - Docs: `docs/unit-test-plan.md`.

- [ ] Kind: implementation | Status: todo | Cover baseline CLI scripts and hook routing contracts.
  - Outcome: Basic scripts are tested through their public CLI contracts, including success and failure cases.
  - Surface: `doctor.mjs`, `install-hooks.mjs`, `init-epic.mjs`, task/phase status scripts, role handoff scripts, `hook.mjs`.
  - Acceptance: Tests run scripts in isolated temp projects and assert exit codes, stdout/stderr contracts, generated files, and no-op behavior for unbound sessions.
  - Docs: `docs/unit-test-plan.md`.

- [ ] Kind: verification | Status: todo | Verify the deterministic unit suite and repo validation together.
  - Outcome: Unit coverage is stable and integrated with existing validation.
  - Surface: Test command, `pnpm run validate`, coverage output if configured.
  - Acceptance: Run the unit test command and `pnpm run validate`; evidence includes passing command output, coverage summary or explicit tested-surface list, and no committed runtime/debug artifacts.
  - Docs: `docs/unit-test-plan.md`.

- [ ] Kind: review | Status: todo | Stop after Phase 1 completion before continuing to eval fixture work.
  - Outcome: Implementation pauses after the deterministic unit test foundation is complete.
  - Surface: Epic tracker, implementation loop routing, `state-of-epic.md` re-entry notes.
  - Acceptance: After Phase 1 verification is complete, the loop stops instead of starting Phase 2 automatically; the next session can resume only after explicit user confirmation.
  - Docs: `tracker.md`, `state-of-epic.md`.

### Phase 2: Agent Eval Fixture Projects

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Add three fixture projects for agent eval runs.
  - Outcome: The repository contains three small but realistic target projects that can be copied or run in isolation for skill evals.
  - Surface: Fixture directory chosen during implementation, package/test files for each fixture, fixture README files.
  - Acceptance: Each fixture has a distinct project shape, deterministic local validation command, and enough code surface for multi-phase epic work.
  - Docs: `docs/eval-fixtures-plan.md`.

- [ ] Kind: implementation | Status: todo | Author multi-phase epic scenarios for the three fixtures.
  - Outcome: Each fixture has an English eval scenario that can initialize and drive an `epic-loop` run.
  - Surface: Fixture scenario files, expected artifact templates, evaluation prompts.
  - Acceptance: Every scenario includes at least three phases, implementation tasks, verification tasks, acceptance criteria, and expected evidence.
  - Docs: `docs/eval-fixtures-plan.md`.

- [ ] Kind: verification | Status: todo | Verify fixture projects are isolated and runnable.
  - Outcome: Fixture projects can be used repeatedly without leaking runtime state into the plugin repo.
  - Surface: Fixture validation commands, temp project copy path, `.gitignore` or cleanup scripts.
  - Acceptance: Run each fixture's validation command from a clean temp copy; evidence includes command output, absence of committed `.epic-loop/.runtime` logs, and clear cleanup instructions.
  - Docs: `docs/eval-fixtures-plan.md`.

### Phase 3: Codex Eval Harness Research And Trace Design

- Phase status: todo

- [ ] Kind: documentation-only | Status: todo | Research Codex-compatible automated skill eval execution.
  - Outcome: The project has a grounded recommendation for how to run Codex with this local skill against fixture projects.
  - Surface: Official Codex/OpenAI documentation, local Codex CLI behavior, available plugin/MCP tooling, repo scripts.
  - Acceptance: Research identifies candidate approaches, chosen path, rejected paths, setup requirements, and traceability limits.
  - Docs: `docs/eval-harness-research.md`, `decision-log.md`.

- [ ] Kind: implementation | Status: todo | Build the eval runner and trace capture scaffold.
  - Outcome: A local command can launch or orchestrate eval runs against fixtures and store normalized traces/results.
  - Surface: Eval scripts, fixture copy/bootstrap logic, trace/result schema, ignored runtime output directory.
  - Acceptance: Runner supports selecting fixtures, records prompts/events/results, separates committed summaries from ignored raw traces, and exits non-zero on harness failures.
  - Docs: `docs/eval-harness-research.md`.

- [ ] Kind: verification | Status: todo | Smoke-test the eval runner on one fixture.
  - Outcome: The harness is proven against a real fixture before broad scoring work begins.
  - Surface: Selected fixture, eval runner command, trace output, result summary.
  - Acceptance: Run one end-to-end or constrained smoke eval; evidence includes trace path, result JSON/summary, clear pass/fail status, and cleanup of transient workspace state.
  - Docs: `docs/eval-harness-research.md`.

### Phase 4: Metrics, Baseline Runs, And Regression Pipeline

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Define eval metrics and scoring thresholds.
  - Outcome: Eval results can be judged consistently across future skill changes.
  - Surface: Metrics documentation, result schema, scoring script or evaluator config.
  - Acceptance: Metrics cover task completion, artifact correctness, lifecycle discipline, verification quality, trace completeness, and regression severity.
  - Docs: `docs/metrics-and-regression-plan.md`.

- [ ] Kind: implementation | Status: todo | Run baseline evals across all fixture projects and record results.
  - Outcome: The repo has a baseline eval record for future comparison.
  - Surface: Eval runner output, committed summary artifacts, ignored raw traces.
  - Acceptance: All three fixture scenarios are run; results include scores, failures, notes, trace references, and known variance or flake observations.
  - Docs: `docs/metrics-and-regression-plan.md`.

- [ ] Kind: implementation | Status: todo | Add regression pipeline for unit and eval checks.
  - Outcome: Future changes can detect deterministic regressions and meaningful eval regressions.
  - Surface: Package scripts, CI workflow if present, eval regression config, documentation.
  - Acceptance: Pipeline runs unit tests and the selected eval regression subset; expensive/full eval path is documented separately if not suitable for every CI run.
  - Docs: `docs/metrics-and-regression-plan.md`.

- [ ] Kind: verification | Status: todo | Verify the regression pipeline catches a controlled failure.
  - Outcome: The regression setup is proven to fail for real breakage and pass after cleanup.
  - Surface: Local or CI pipeline command, temporary controlled failure, trace/result output.
  - Acceptance: Introduce a temporary failure or use a fixture negative case, confirm the pipeline fails with useful diagnostics, revert the temporary change, rerun successfully, and record evidence without committing transient artifacts.
  - Docs: `docs/metrics-and-regression-plan.md`.

