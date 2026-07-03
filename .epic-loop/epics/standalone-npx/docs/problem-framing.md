# Epic Problem Framing

## Problem

Standalone npx epic-loop CLI package: (1) a manual tool for users to browse, manage, and repair their epics inside a project, (2) internal skill scripts migrated to call this CLI instead of scattered scripts, making all invocations unambiguous and reducing friction, plus (3) utility commands like installing hooks for Claude Code / Codex and detecting what's set up in a project. Exact command surface for users and the agent to be worked out in shaping mode.

## Desired Outcome

A standalone, publicly published npm package named `epic-loop`, runnable as `npx epic-loop <command>`, that serves two audiences:

1. **End users**: a manual tool to browse, manage, and repair their epics inside a project (list epics, inspect status, switch lifecycle mode, fix broken/inconsistent state).
2. **The epic-loop skill itself**: the skill's internal script invocations (`scripts/*.mjs`) are migrated to call this CLI instead, so every skill-triggered action is a single unambiguous command rather than a scattered set of individual scripts, reducing invocation friction for the agent.

The package also grows a small utility surface: install hooks for Claude Code / Codex, detect what's already set up in a project, and other one-off setup/diagnostic commands.

## Scope

- New package at `packages/cli`, npm name `epic-loop`, published publicly (name confirmed available on the npm registry as of shaping).
- `packages/cli` is a self-contained npm package with its own `package.json` and its own dependency install — not a pnpm workspace member. The repo root is a private plugin/skill distribution, not a code library, so there is no second package to share tooling or dependencies with; a `pnpm-workspace.yaml` is not introduced unless/until an actual second package or genuine shared-dependency need appears.
- Phase 2: package bootstrap, build process, the zero-argument root command (find project root upward from cwd, detect `.epic-loop`, print existing epics with mode + implementation-loop state), pre-publish verification, manual `npm publish` by the user.
- Phase 3: research of CLI parsing / pretty-output / interactive-TUI libraries; several competing prototype implementations of the same small feature set (a couple of commands + interactive epic picker + mode-switch command) built on different stacks; user reviews and picks a winner; package consolidated onto the chosen stack.
- Phase 4: research + brainstorm of the full user-facing command surface for convenient epic management and fast status/problem visibility; committed command spec; implementation; testing against fixture projects/epics.
- Phase 5: inventory every script the skill currently invokes; wrap that surface as an internal CLI command branch; capture baseline speed/token metrics of the skill running on today's scripts via eval-fixture runs; migrate the skill to call the CLI; re-run eval and compare; evidence-based decision to adopt, drop, or iterate further.
- Package language starts as plain JavaScript (ESM), matching the rest of the repo. This is a starting point only, not a constraint — Phase 3 may move to TypeScript if the chosen stack benefits from it, without that being treated as scope creep.
- Unlike the skill's own `scripts/*.mjs` (Node built-ins only, no runtime deps), `packages/cli` may take on npm dependencies where justified (CLI parsing, output styling, TUI).

## Non-Scope

- Rewriting the skill's `manager -> techlead -> engineer` loop logic itself — this epic changes how the skill *invokes* operations (via CLI instead of scattered scripts), not the loop's role/routing design.
- Automated CI-based npm publishing. Phase 2 publish is a manual, user-executed action; CI-based release automation is not part of this epic unless raised later.
- Building a new eval/metrics harness from scratch in Phase 5. Eval-fixture pipeline work is owned by the separate `test-coverage` epic (its Phase 2, not yet started). This epic's Phase 5 coordinates with and reuses that harness rather than duplicating it.
- Introducing pnpm-workspace/monorepo tooling for its own sake — only justified later if a genuine second package or shared-dependency need appears.

## Constraints

- Conversation with the user happens in Russian; all epic docs, code, and artifacts are strictly English.
- Package lives at `packages/cli` inside this repo, not a separate repo, but as a self-contained package rather than a formal pnpm workspace member.
- npm package name: `epic-loop` (public).
- Phase 5 eval-metrics work must coordinate with the `test-coverage` epic instead of building a competing harness (user decision, captured in `decision-log.md`).

## Open Questions

- Exact user-facing command surface (names, flags, output shape) is deliberately deferred to Phase 4 research/spec.
- Exact CLI-parsing/output/TUI library choice is deliberately deferred to Phase 3 research + prototype comparison.
- Coordination mechanics with the `test-coverage` epic for Phase 5 (who builds/owns the shared eval harness, how the two epics hand off) are not yet detailed — to be worked out when Phase 5 starts, informed by `test-coverage`'s own progress at that time.
