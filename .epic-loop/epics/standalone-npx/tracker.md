# Tracker

Epic: epic-loop Standalone CLI Package (`npx epic-loop`)

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

### Phase 1: Shape The Epic

- Phase status: done

- [x] Kind: documentation-only | Status: done | Capture problem framing, desired outcome, scope, non-scope, constraints, risks, and initial open questions.
  - Outcome: The epic has enough structure for phase and task decomposition.
  - Surface: `docs/`, `decision-log.md`, `risk-register.md`, `state-of-epic.md`.
  - Acceptance: A future session can understand why this epic exists and what should happen next.
  - Docs: `docs/problem-framing.md`, `decision-log.md`, `risk-register.md`.

### Phase 2: Bootstrap The Package And Ship The Zero-Arg Status Command

- Phase status: doing

- [x] Kind: implementation | Status: done | Bootstrap `packages/cli` as a self-contained npm package.
  - Outcome: `packages/cli` exists as an independent, publishable npm package named `epic-loop`, with its own `package.json` and its own dependency install (no pnpm workspace); the existing root package/scripts keep working unchanged since nothing at the root references it.
  - Surface: `packages/cli/package.json` (name, bin, version, license, repository, files), `packages/cli` source entry, `packages/cli/README.md`.
  - Acceptance: `packages/cli/package.json` has valid npm package metadata and a `bin` entry pointing at a runnable entrypoint; running `pnpm install` (or `npm install`) from inside `packages/cli` installs cleanly on its own; `pnpm run test:unit` and `pnpm run validate` at the repo root still pass unchanged.
  - Docs: `docs/bootstrap.md`.

- [ ] Kind: implementation | Status: todo | Set up the build process for the CLI package.
  - Outcome: `packages/cli` source builds into a distributable, executable artifact that can be run directly and later resolved through `npx epic-loop`.
  - Surface: `packages/cli` build tooling/config, `packages/cli/package.json` scripts (`build`, `dev` as applicable), `files`/`exports` fields needed for a clean publish.
  - Acceptance: a documented build command produces a working entrypoint; running the built entrypoint directly (e.g. `node packages/cli/dist/...`) executes without runtime errors.
  - Docs: `docs/bootstrap.md`.

- [ ] Kind: implementation | Status: todo | Implement the zero-argument root command.
  - Outcome: running the CLI with no arguments walks up from the current working directory to find the project root, checks for `.epic-loop`, and — when found — prints a concise list of existing epics with each epic's current lifecycle mode and, when the epic is in implementation mode, its implementation-loop state.
  - Surface: `packages/cli` entrypoint, a project-root discovery utility (upward directory walk), an epic listing/status reader (may port logic from the skill's `list-epics.mjs` / `role-summary.mjs`).
  - Acceptance: run from a nested subdirectory of a project containing `.epic-loop/epics/*`, the command finds the root and prints each epic's slug/title, mode, and implementation-loop state where applicable; run outside any `.epic-loop` project, it reports that clearly instead of crashing or printing nothing.
  - Docs: `docs/bootstrap.md`.

- [ ] Kind: verification | Status: todo | Verify the bootstrap and zero-arg command end-to-end, and prepare the package for publish.
  - Docs: `docs/bootstrap.md`.

### Phase 3: Research And Select The CLI/TUI Stack

- Phase status: todo

- [ ] Kind: documentation-only | Status: todo | Research candidate libraries for CLI argument parsing, styled output, and interactive TUI, and shortlist 2-4 stacks.
  - Outcome: a written comparison of shortlisted stacks with tradeoffs relevant to this CLI's needs (zero/near-zero dependency footprint preference, interactive epic picker, pretty status output).
  - Surface: `docs/cli-stack-research.md`.
  - Acceptance: the doc lists shortlisted CLI-parsing, output-styling, and interactive-TUI libraries/approaches with pros/cons and a recommendation basis for the prototype step.
  - Docs: `docs/cli-stack-research.md`.

- [ ] Kind: implementation | Status: todo | Build competing prototype variants of the same small feature set on different shortlisted stacks.
  - Outcome: 2-3 runnable prototypes, each implementing the same UX (epic list/status, interactive epic picker when no slug is given, an epic mode-switch command, styled output) on a different candidate stack, ready for side-by-side user review.
  - Surface: isolated prototype locations inside `packages/cli` (e.g. per-stack experiment folders), interactive epic-selection flow, mode-switch command.
  - Acceptance: each prototype runs standalone and demonstrably covers: epic list, interactive picker (no-slug path), explicit mode-switch command, styled/pretty output.
  - Docs: `docs/cli-stack-research.md`.

- [ ] Kind: review | Status: todo | Present the prototypes to the user for manual comparison and record the selected stack.
  - Outcome: the user has compared the running prototypes and picked a winning stack; the decision and rationale are recorded.
  - Surface: `decision-log.md`.
  - Acceptance: `decision-log.md` records the chosen library stack with rationale and notes on rejected alternatives.
  - Docs: `decision-log.md`.

- [ ] Kind: implementation | Status: todo | Consolidate the package onto the selected stack.
  - Outcome: `packages/cli` is left in a single clean state built only on the chosen stack; losing prototypes and their dependencies are removed.
  - Surface: `packages/cli` source tree, `packages/cli/package.json` dependencies.
  - Acceptance: only the selected stack's dependencies remain; the Phase 2 zero-arg command and build process still work on the consolidated stack.
  - Docs: `docs/cli-stack-research.md`.

- [ ] Kind: verification | Status: todo | Verify the consolidated CLI on the chosen stack, covering both the zero-arg status command and the new interactive/mode-switch commands.
  - Docs: `docs/cli-stack-research.md`.

### Phase 4: Design And Ship The Full User Command Surface

- Phase status: todo

- [ ] Kind: documentation-only | Status: todo | Research and brainstorm the full user-facing command surface, then commit a CLI command spec.
  - Outcome: a committed spec enumerating the full command set for convenient epic management and fast status/problem visibility (browse/list, detail/status, mode transitions, repair/fix operations, diagnostics), each with purpose, arguments, flags, and example output.
  - Surface: `docs/cli-command-spec.md`.
  - Acceptance: every command a user needs for day-to-day epic management is represented in the spec with concrete example output, not just a name.
  - Docs: `docs/cli-command-spec.md`.

- [ ] Kind: implementation | Status: todo | Implement the committed command set.
  - Outcome: every command in the spec exists in `packages/cli` and behaves per spec.
  - Surface: `packages/cli` subcommand modules, shared formatting/output helpers.
  - Acceptance: each spec'd command is runnable and its observed output/behavior matches the spec.
  - Docs: `docs/cli-command-spec.md`.

- [ ] Kind: verification | Status: todo | Verify the full command surface against real epics using fixture projects.
  - Docs: `docs/cli-command-spec.md`.

### Phase 5: Migrate The Skill Onto The CLI, Decide With Evidence

- Phase status: todo

- [ ] Kind: documentation-only | Status: todo | Inventory every script the skill invokes today and map each to its planned CLI replacement.
  - Outcome: a complete mapping from current `scripts/*.mjs` call sites (as referenced in `SKILL.md` and `references/*.md`) to the CLI subcommand that would replace each one, including any gaps needing new CLI functionality.
  - Surface: `docs/skill-migration-map.md`.
  - Acceptance: every script invocation referenced in `SKILL.md`/`references/*.md` has an identified CLI replacement or an explicit noted gap.
  - Docs: `docs/skill-migration-map.md`.

- [ ] Kind: implementation | Status: todo | Expose the skill-facing operations as a dedicated internal command branch of the CLI.
  - Outcome: the CLI has a stable, unambiguous internal command surface the skill can call in place of individual scripts, distinct from the user-facing command surface from Phase 4.
  - Surface: `packages/cli` internal command branch.
  - Acceptance: the internal command branch covers the full mapping from the inventory task; each internal command is independently runnable/testable outside the skill.
  - Docs: `docs/skill-migration-map.md`.

- [ ] Kind: verification | Status: todo | Capture baseline speed/token metrics of the skill running on today's scripts, via eval-fixture runs coordinated with the `test-coverage` epic.
  - Docs: `docs/skill-eval-metrics.md`.

- [ ] Kind: implementation | Status: todo | Switch the skill's `SKILL.md`/`references/*.md` and script call sites to the new CLI internal commands.
  - Outcome: the skill invokes the CLI package instead of individual scripts for every mapped operation.
  - Surface: `plugins/epic-loop/skills/epic-loop/SKILL.md`, `plugins/epic-loop/skills/epic-loop/references/*.md`, existing script call sites, matching unit/contract tests.
  - Acceptance: the skill runs end-to-end using only CLI-mediated calls for the mapped operations; `hook-contracts.test.mjs`/`cli-contracts.test.mjs` and related tests are updated to match.
  - Docs: `docs/skill-migration-map.md`.

- [ ] Kind: verification | Status: todo | Re-run the same eval scenario on the CLI-based skill, compare against baseline, and record the adopt/drop/iterate decision.
  - Docs: `docs/skill-eval-metrics.md`, `decision-log.md`.

