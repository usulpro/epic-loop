#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const epicRoot = path.join(repoRoot, ".epic-loop", "epics", "eval-fixture");
const fixtureRoot = path.join(repoRoot, "temp", "eval-fixture-project");

const baselineFiles = {
  "state-of-epic.md": String.raw`# State Of Epic

Epic: Eval Fixture Epic For Testing Epic-loop Role Routing
Slug: ` + "`eval-fixture`" + String.raw`
Created: 2026-07-02T07:16:07+00:00
Current mode: shaping
Active phase: Phase 1 - Build Isolated Utility Fixture
Active task: Phase 1 Task 1 - Create string normalization utilities with tests

## Current State

- The epic has been shaped as a two-phase eval fixture for testing epic-loop implementation flow.
- The implementation target is an isolated mini-project under ` + "`temp/eval-fixture-project`" + String.raw`.
- The roadmap includes concrete implementation tasks and phase-level verification.
- No implementation has started yet.

## Blockers

- None recorded.

## Next Action

- Ask for explicit implementation confirmation in the current session, then bind the session to ` + "`eval-fixture`" + String.raw` in implementation mode.

## Re-Entry Notes

- Do not create or modify production plugin code for this epic.
- Implementation should only touch ` + "`temp/eval-fixture-project`" + String.raw`.
- Use the visible ` + "`tracker.md`" + String.raw` order as the source of truth for task selection.
`,

  "tracker.md": String.raw`# Tracker

Epic: Eval Fixture Epic For Testing Epic-loop Role Routing

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

### Phase 1: Build Isolated Utility Fixture

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Create string normalization utilities with tests.
  - Outcome: ` + "`temp/eval-fixture-project`" + String.raw` contains tested slug/title helpers that handle normalization and duplicate slug generation.
  - Surface: ` + "`temp/eval-fixture-project/src/slug-tools.mjs`" + String.raw`, ` + "`temp/eval-fixture-project/test/slug-tools.test.mjs`" + String.raw`.
  - Acceptance: ` + "`normalizeTitle`" + String.raw` and ` + "`createStableSlug`" + String.raw` are exported, covered by ` + "`node:test`" + String.raw`, and handle whitespace, punctuation, and duplicate slug suffixes.
  - Docs: ` + "`docs/problem-framing.md`" + String.raw`, ` + "`docs/phase-1-utility-fixture.md`" + String.raw`.

- [ ] Kind: implementation | Status: todo | Create candidate scoring utilities with tests.
  - Outcome: ` + "`temp/eval-fixture-project`" + String.raw` contains tested score helpers for ranking candidates and summarizing score distributions.
  - Surface: ` + "`temp/eval-fixture-project/src/scoreboard.mjs`" + String.raw`, ` + "`temp/eval-fixture-project/test/scoreboard.test.mjs`" + String.raw`.
  - Acceptance: ` + "`rankCandidates`" + String.raw` and ` + "`summarizeScores`" + String.raw` are exported, covered by ` + "`node:test`" + String.raw`, and handle sorting, tied ranks, averages, and invalid input behavior.
  - Docs: ` + "`docs/problem-framing.md`" + String.raw`, ` + "`docs/phase-1-utility-fixture.md`" + String.raw`.

- [ ] Kind: verification | Status: todo | Verify phase 1 utility fixture through Node test runner.
  - Outcome: Phase 1 utility modules are proven through real test execution before integration work starts.
  - Surface: ` + "`temp/eval-fixture-project/src/**`" + String.raw`, ` + "`temp/eval-fixture-project/test/**`" + String.raw`, Node.js test runner output.
  - Acceptance: Run ` + "`node --test temp/eval-fixture-project/test/*.test.mjs`" + String.raw`; expected evidence is exit code ` + "`0`" + String.raw`, passing tests for slug and scoreboard modules, and no changed files outside ` + "`temp/eval-fixture-project`" + String.raw` except epic artifacts.
  - Docs: ` + "`docs/phase-1-utility-fixture.md`" + String.raw`.

### Phase 2: Integrate Report Builder Fixture

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Create report builder integration module with tests.
  - Outcome: ` + "`temp/eval-fixture-project`" + String.raw` contains an integration module that composes phase 1 helpers into deterministic candidate reports.
  - Surface: ` + "`temp/eval-fixture-project/src/report-builder.mjs`" + String.raw`, ` + "`temp/eval-fixture-project/test/report-builder.test.mjs`" + String.raw`, existing phase 1 modules.
  - Acceptance: ` + "`buildCandidateReport`" + String.raw` and ` + "`formatCandidateReport`" + String.raw` are exported, covered by ` + "`node:test`" + String.raw`, reuse phase 1 helpers, and handle normal and empty or invalid input cases.
  - Docs: ` + "`docs/problem-framing.md`" + String.raw`, ` + "`docs/phase-2-report-builder.md`" + String.raw`.

- [ ] Kind: verification | Status: todo | Verify combined mini-project behavior.
  - Outcome: The complete ` + "`temp/eval-fixture-project`" + String.raw` mini-project is proven through tests and a direct runtime import.
  - Surface: ` + "`temp/eval-fixture-project/src/**`" + String.raw`, ` + "`temp/eval-fixture-project/test/**`" + String.raw`, Node.js test runner output, one-off Node import output.
  - Acceptance: Run ` + "`node --test temp/eval-fixture-project/test/*.test.mjs`" + String.raw` and the documented ` + "`node -e`" + String.raw` import command; expected evidence is exit code ` + "`0`" + String.raw`, passing tests, stdout containing the formatted report slug and ranked candidates, and the fixture folder still present after verification.
  - Docs: ` + "`docs/phase-2-report-builder.md`" + String.raw`.
`,

  "implementation-log.md": String.raw`# Implementation Log

## 2026-07-02T07:16:07+00:00 - Epic Workspace Initialized

- Created epic workspace for ` + "`eval-fixture`" + String.raw`.
- Initial mode: shaping.

## 2026-07-02T07:20:00+00:00 - Shaping Completed

- Captured the eval fixture intent, scope, constraints, decisions, and risks.
- Replaced the initial shaping stub with two implementation phases:
  - Phase 1 builds and verifies isolated utility modules under ` + "`temp/eval-fixture-project`" + String.raw`.
  - Phase 2 adds an integration module and verifies the combined fixture while leaving the project folder in place.
- Implementation has not started; it requires explicit user confirmation and session binding.

## 2026-07-02T07:35:00+00:00 - Reset Flow Added

- Added repository script ` + "`npm run eval-fixture-reset`" + String.raw` to restore this epic baseline and remove ` + "`temp/eval-fixture-project`" + String.raw`.
- Removed cleanup from the implementation roadmap so completed eval output remains available for inspection.
`,

  "decision-log.md": String.raw`# Decision Log

## Active Decisions

- 2026-07-02: Use an isolated ` + "`temp/eval-fixture-project`" + String.raw` mini-project as the eval surface.
  - Motivation: The eval should exercise real file creation, test writing, verification, task status transitions, and final inspectable output without changing plugin behavior.
  - Rejected alternatives: modifying plugin scripts directly; creating a package-level fixture with dependency changes; using only documentation tasks.
  - Status: active.

- 2026-07-02: Use .mjs modules plus built-in ` + "`node:test`" + String.raw`.
  - Motivation: This keeps implementation deterministic, dependency-free, and easy for multiple agents to run.
  - Rejected alternatives: adding Jest/Vitest dependencies; creating a separate package manager workspace under the fixture folder.
  - Status: active.

- 2026-07-02: Keep the fixture project after successful implementation.
  - Motivation: Eval runs should leave the completed mini-project available for inspection after the loop finishes.
  - Rejected alternatives: deleting the fixture as the final implementation task.
  - Status: active.

- 2026-07-02: Reset the eval through ` + "`npm run eval-fixture-reset`" + String.raw`.
  - Motivation: Reset should be explicit, repeatable, and independent from the implementation roadmap being evaluated.
  - Rejected alternatives: relying on manual cleanup; adding cleanup back as a final epic task.
  - Status: active.

## Historical Decisions

- None recorded.
`,

  "risk-register.md": String.raw`# Risk Register

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| Implementation touches production plugin files instead of the isolated fixture. | Eval run becomes noisy and may create unrelated product diffs. | Every implementation task names ` + "`temp/eval-fixture-project`" + String.raw` as the surface; reset script clears only the epic baseline and fixture folder. | open |
| Verification is too shallow and misses broken modules or imports. | The eval may pass even when agent work is incomplete. | Each phase has a concrete ` + "`node --test`" + String.raw` verification task with expected stdout and behavior evidence. | open |
| Reset deletes too much. | Accidental removal outside the fixture folder or epic workspace. | Reset script uses fixed repository-relative paths and refuses to remove paths outside the repository root. | open |
| Task is too trivial to exercise role handoff and status transitions. | The eval may not cover enough loop behavior. | Roadmap includes multiple implementation tasks across two phases plus verification. | open |
`,

  "docs/problem-framing.md": String.raw`# Epic Problem Framing

## Problem

The epic-loop implementation flow needs a realistic but low-risk eval scenario that exercises normal phase and task orchestration without changing the plugin product code.

This epic provides that fixture by asking the loop to create a tiny isolated JavaScript project under ` + "`temp/eval-fixture-project`" + String.raw`, implement several small utility modules, write tests for them, verify the work, and leave the completed fixture available for inspection.

## Desired Outcome

- A normal-looking epic with two implementation phases and concrete tasks.
- Each phase contains at least one verification task with explicit commands, evidence, setup, and cleanup notes.
- The implementation loop has enough real work to exercise manager, techlead, engineer, tracker transitions, logs, and verification behavior.
- The final repository state should retain ` + "`temp/eval-fixture-project`" + String.raw` until ` + "`npm run eval-fixture-reset`" + String.raw` is run.

## Scope

- Create files only under ` + "`temp/eval-fixture-project`" + String.raw` during implementation.
- Use built-in Node.js facilities where possible: .mjs modules and ` + "`node:test`" + String.raw`.
- Implement simple but non-trivial pure functions with edge cases and tests.
- Run verification commands that prove the functions and tests work.
- Provide a repository reset script that restores this epic baseline and removes ` + "`temp/eval-fixture-project`" + String.raw`.

## Non-Scope

- No changes to the epic-loop plugin, hook scripts, production package configuration, or production source during the epic implementation itself.
- No new package dependencies.
- No network services, browser automation, database, or external APIs.
- No implementation cleanup task that deletes the fixture folder after successful completion.

## Constraints

- The eval mini-project must stay isolated from the main repository.
- Implementation must be easy for different agents to complete independently.
- The work should be simple enough for stable eval runs but detailed enough to reveal broken task routing, role switching, status updates, or verification.
- ` + "`temp/`" + String.raw` is ignored by git, so completed fixture output should remain local runtime material.

## Reset

Run:

` + "```bash" + String.raw`
npm run eval-fixture-reset
` + "```" + String.raw`

The reset script rewrites .epic-loop/epics/eval-fixture from its embedded baseline and removes ` + "`temp/eval-fixture-project`" + String.raw`.

## Open Questions

- None. The epic is ready for implementation once the user explicitly starts it in a session.
`,

  "docs/phase-1-utility-fixture.md": String.raw`# Phase 1 Utility Fixture

## Intent

Create the first half of the isolated eval mini-project under ` + "`temp/eval-fixture-project`" + String.raw`.

The work should be small but real: pure JavaScript modules, edge cases, tests, and a phase-level verification command.

## Implementation Surface

- ` + "`temp/eval-fixture-project/src/slug-tools.mjs`" + String.raw`
- ` + "`temp/eval-fixture-project/src/scoreboard.mjs`" + String.raw`
- ` + "`temp/eval-fixture-project/test/slug-tools.test.mjs`" + String.raw`
- ` + "`temp/eval-fixture-project/test/scoreboard.test.mjs`" + String.raw`

No files outside ` + "`temp/eval-fixture-project`" + String.raw` should be created or modified during this phase.

## Expected Functions

` + "`slug-tools.mjs`" + String.raw` should export:

- ` + "`normalizeTitle(value)`" + String.raw`: trims input, lowercases it, collapses whitespace, strips unsupported punctuation, and returns a readable normalized title.
- ` + "`createStableSlug(value, existing = [])`" + String.raw`: creates a URL-safe slug from a title and appends ` + "`-2`" + String.raw`, ` + "`-3`" + String.raw`, etc. when the slug already exists.

` + "`scoreboard.mjs`" + String.raw` should export:

- ` + "`rankCandidates(candidates)`" + String.raw`: sorts candidates by descending score, keeps stable alphabetical tie ordering by name, and returns rank numbers that share ranks for tied scores.
- ` + "`summarizeScores(candidates)`" + String.raw`: returns count, highest score, lowest score, and average score rounded to two decimals.

## Test Expectations

Tests should use built-in ` + "`node:test`" + String.raw` and ` + "`node:assert/strict`" + String.raw`.

Coverage should include:

- whitespace and punctuation normalization
- duplicate slug suffixing
- score sorting
- tied ranks
- summary statistics
- invalid input behavior where reasonable

## Verification

Run:

` + "```bash" + String.raw`
node --test temp/eval-fixture-project/test/*.test.mjs
` + "```" + String.raw`

Evidence:

- command exits with code ` + "`0`" + String.raw`
- stdout reports passing tests for both phase 1 modules
- repository diff shows implementation files only under ` + "`temp/eval-fixture-project`" + String.raw`
`,

  "docs/phase-2-report-builder.md": String.raw`# Phase 2 Report Builder

## Intent

Extend the isolated fixture with a small integration module that composes phase 1 utilities, verify the full mini-project, and leave the completed folder available for inspection.

## Implementation Surface

- ` + "`temp/eval-fixture-project/src/report-builder.mjs`" + String.raw`
- ` + "`temp/eval-fixture-project/test/report-builder.test.mjs`" + String.raw`
- existing phase 1 fixture files under ` + "`temp/eval-fixture-project`" + String.raw`

No production plugin files should be changed.

## Expected Functions

` + "`report-builder.mjs`" + String.raw` should export:

- ` + "`buildCandidateReport(input)`" + String.raw`: accepts a report title and candidate list, builds a stable report slug, ranked candidates, and score summary.
- ` + "`formatCandidateReport(report)`" + String.raw`: returns deterministic plain text with the normalized title, slug, ranked candidate lines, and summary line.

The implementation should reuse ` + "`slug-tools.mjs`" + String.raw` and ` + "`scoreboard.mjs`" + String.raw` instead of duplicating their logic.

## Test Expectations

Tests should use built-in ` + "`node:test`" + String.raw` and ` + "`node:assert/strict`" + String.raw`.

Coverage should include:

- composed report slug generation
- ranking output from the phase 1 scoreboard helper
- formatted plain-text output
- behavior for an empty candidate list or invalid candidate payload

## Combined Verification

Run:

` + "```bash" + String.raw`
node --test temp/eval-fixture-project/test/*.test.mjs
node -e "import('./temp/eval-fixture-project/src/report-builder.mjs').then(({ buildCandidateReport, formatCandidateReport }) => { const report = buildCandidateReport({ title: 'July Eval Round', candidates: [{ name: 'Ada', score: 9 }, { name: 'Linus', score: 8 }] }); console.log(formatCandidateReport(report)); })"
` + "```" + String.raw`

Evidence:

- test command exits with code ` + "`0`" + String.raw`
- one-off import command exits with code ` + "`0`" + String.raw`
- stdout includes the report slug and ranked candidate lines
- ` + "`temp/eval-fixture-project`" + String.raw` remains present after verification
`,

  ".runtime/roadmap-state.json": JSON.stringify({
    schema_version: 1,
    slug: "eval-fixture",
    title: "Eval Fixture Epic For Testing Epic-loop Role Routing",
    active_phase_id: "phase-1",
    active_task_id: "phase-1-task-1",
    statuses: ["todo", "doing", "need-review", "blocked", "partially-satisfied", "deferred", "reset-required", "done"],
    kinds: ["implementation", "verification", "review", "follow-up", "architecture-reset", "documentation-only"],
    phases: [
      {
        id: "phase-1",
        title: "Build Isolated Utility Fixture",
        status: "todo",
        tasks: [
          {
            id: "phase-1-task-1",
            title: "Create string normalization utilities with tests.",
            kind: "implementation",
            status: "todo",
            outcome: "`temp/eval-fixture-project` contains tested slug/title helpers that handle normalization and duplicate slug generation.",
            surface: "`temp/eval-fixture-project/src/slug-tools.mjs`, `temp/eval-fixture-project/test/slug-tools.test.mjs`.",
            acceptance: "`normalizeTitle` and `createStableSlug` are exported, covered by `node:test`, and handle whitespace, punctuation, and duplicate slug suffixes.",
            docs: "`docs/problem-framing.md`, `docs/phase-1-utility-fixture.md`.",
          },
          {
            id: "phase-1-task-2",
            title: "Create candidate scoring utilities with tests.",
            kind: "implementation",
            status: "todo",
            outcome: "`temp/eval-fixture-project` contains tested score helpers for ranking candidates and summarizing score distributions.",
            surface: "`temp/eval-fixture-project/src/scoreboard.mjs`, `temp/eval-fixture-project/test/scoreboard.test.mjs`.",
            acceptance: "`rankCandidates` and `summarizeScores` are exported, covered by `node:test`, and handle sorting, tied ranks, averages, and invalid input behavior.",
            docs: "`docs/problem-framing.md`, `docs/phase-1-utility-fixture.md`.",
          },
          {
            id: "phase-1-task-3",
            title: "Verify phase 1 utility fixture through Node test runner.",
            kind: "verification",
            status: "todo",
            outcome: "Phase 1 utility modules are proven through real test execution before integration work starts.",
            surface: "`temp/eval-fixture-project/src/**`, `temp/eval-fixture-project/test/**`, Node.js test runner output.",
            acceptance: "Run `node --test temp/eval-fixture-project/test/*.test.mjs`; expected evidence is exit code `0`, passing tests for slug and scoreboard modules, and no changed files outside `temp/eval-fixture-project` except epic artifacts.",
            docs: "`docs/phase-1-utility-fixture.md`.",
          },
        ],
      },
      {
        id: "phase-2",
        title: "Integrate Report Builder Fixture",
        status: "todo",
        tasks: [
          {
            id: "phase-2-task-1",
            title: "Create report builder integration module with tests.",
            kind: "implementation",
            status: "todo",
            outcome: "`temp/eval-fixture-project` contains an integration module that composes phase 1 helpers into deterministic candidate reports.",
            surface: "`temp/eval-fixture-project/src/report-builder.mjs`, `temp/eval-fixture-project/test/report-builder.test.mjs`, existing phase 1 modules.",
            acceptance: "`buildCandidateReport` and `formatCandidateReport` are exported, covered by `node:test`, reuse phase 1 helpers, and handle normal and empty or invalid input cases.",
            docs: "`docs/problem-framing.md`, `docs/phase-2-report-builder.md`.",
          },
          {
            id: "phase-2-task-2",
            title: "Verify combined mini-project behavior.",
            kind: "verification",
            status: "todo",
            outcome: "The complete `temp/eval-fixture-project` mini-project is proven through tests and a direct runtime import.",
            surface: "`temp/eval-fixture-project/src/**`, `temp/eval-fixture-project/test/**`, Node.js test runner output, one-off Node import output.",
            acceptance: "Run `node --test temp/eval-fixture-project/test/*.test.mjs` and the documented `node -e` import command; expected evidence is exit code `0`, passing tests, stdout containing the formatted report slug and ranked candidates, and the fixture folder still present after verification.",
            docs: "`docs/phase-2-report-builder.md`.",
          },
        ],
      },
    ],
    follow_ups: [],
    updated_at: "2026-07-02T07:35:00+00:00",
  }, null, 2) + "\n",

  ".runtime/runtime-state.json": JSON.stringify({
    active_phase: "Phase 1 - Build Isolated Utility Fixture",
    active_task: "Phase 1 Task 1 - Create string normalization utilities with tests",
    created_at: "2026-07-02T07:16:07+00:00",
    description: "Eval Fixture Epic for testing epic-loop role routing with a two-phase isolated mini project under temp/eval-fixture-project, including simple functions, tests, verification, and explicit reset.",
    execution_brief: null,
    implementation_submode: "techlead",
    mode: "shaping",
    slug: "eval-fixture",
    title: "Eval Fixture Epic For Testing Epic-loop Role Routing",
    updated_at: "2026-07-02T07:35:00+00:00",
  }, null, 2) + "\n",
};

function assertInsideRepo(targetPath) {
  const relative = path.relative(repoRoot, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to touch path outside repository: ${targetPath}`);
  }
}

function writeBaselineFile(relativePath, content) {
  const targetPath = path.join(epicRoot, relativePath);
  assertInsideRepo(targetPath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
}

assertInsideRepo(epicRoot);
assertInsideRepo(fixtureRoot);

fs.rmSync(epicRoot, { recursive: true, force: true });
fs.rmSync(fixtureRoot, { recursive: true, force: true });

for (const [relativePath, content] of Object.entries(baselineFiles)) {
  writeBaselineFile(relativePath, content);
}

console.log("Reset eval-fixture epic baseline.");
console.log("Removed temp/eval-fixture-project.");
