# Implementation Log

## 2026-07-03T16:45:12+00:00 - Epic Workspace Initialized

- Created epic workspace for `standalone-npx`.
- Initial mode: shaping.

## 2026-07-03T17:48:31+00:00 - closed

- Phase: phase-2
- Task: phase-2-task-1: Bootstrap packages/cli as a self-contained npm package
- Verdict: closed
- Changed: packages/cli/package.json,packages/cli/bin/epic-loop.mjs,packages/cli/README.md,packages/cli/pnpm-lock.yaml
- Verification:
  - pnpm install inside packages/cli succeeds independently
  - node bin/epic-loop.mjs prints epic-loop v0.0.1
  - root pnpm run test:unit (33/33 pass) and pnpm run validate pass unchanged
  - git diff confirms root package.json/pnpm-lock.yaml untouched
- Commit: a9eaef0
- Next move: proceed to phase-2-task-2: set up the build process for the CLI package

## 2026-07-03T17:53:20+00:00 - closed

- Phase: phase-2
- Task: phase-2-task-2: Set up the build process for the CLI package
- Verdict: closed
- Changed: packages/cli/src/cli.mjs,packages/cli/scripts/build.mjs,packages/cli/dist/epic-loop.mjs (gitignored),packages/cli/package.json,packages/cli/pnpm-lock.yaml
- Verification:
  - clean-slate rebuild: rm -rf dist && pnpm run build reproduces dist/epic-loop.mjs
  - node dist/epic-loop.mjs and ./dist/epic-loop.mjs (shebang exec) both print epic-loop v0.0.1
  - root pnpm run test:unit (33/33) and pnpm run validate pass unchanged
  - confirmed dist/ is gitignored via git check-ignore
  - confirmed no leftover bin/epic-loop.mjs
- Commit: ebe3b2b
- Next move: proceed to phase-2-task-3: implement the zero-argument root command

## 2026-07-03T17:57:19+00:00 - closed

- Phase: phase-2
- Task: phase-2-task-3: Implement the zero-argument root command
- Verdict: closed
- Changed: packages/cli/src/project-root.mjs,packages/cli/src/epics.mjs,packages/cli/src/cli.mjs
- Verification:
  - independently re-ran all three fixture scenarios against the rebuilt dist: repo root (4 real epics listed correctly incl. standalone-npx's live loop state), nested subdirectory (test-coverage/docs, root found via upward walk), and a directory with no .epic-loop anywhere above it (clear message, exit 1)
  - also confirmed --version still works
  - root pnpm run test:unit (33/33) and pnpm run validate pass unchanged
  - git status confirms no real epic .runtime state was mutated by this read-only testing
- Commit: f3fa046
- Next move: proceed to phase-2-task-4: the phase's verification task (end-to-end verify + npm pack --dry-run), which will close Phase 2

## 2026-07-03T18:00:46+00:00 - closed

- Phase: phase-2
- Task: phase-2-task-4: Verify the bootstrap and zero-arg command end-to-end, prepare for publish
- Verdict: closed
- Changed: packages/cli/package.json (bin path fix: './dist/epic-loop.mjs' -> 'dist/epic-loop.mjs')
- Verification:
  - independently reproduced: npm pack --dry-run before fix showed npm auto-correcting an invalid bin path warning
  - applied npm pkg fix, re-ran npm pack/publish --dry-run with no warnings, tarball contains exactly dist/README.md/package.json (3 files)
  - re-ran zero-arg command from repo root, nested subdirectory, and a no-.epic-loop scratch dir with expected output/exit codes
  - confirmed no leftover .tgz or scratch dirs
  - root pnpm run test:unit (33/33) and pnpm run validate pass unchanged
- Commit: dc05107
- Next move: Phase 2 tasks are all closed; proceed to phase-closure review and mandatory phase-closure-housekeeping, then idle per this run's Phase-2-only scope

## 2026-07-04 - manual publish and manual test (post phase-2 closure)

- Phase: phase-2
- Task: manual, user-executed action noted as out of loop scope by phase-2-task-4 (not an automated task step)
- User published `epic-loop` (packages/cli) to the public npm registry as `v0.1.0` and confirmed manually with a real `npx epic-loop` invocation from this repo root.
- Observed output: correct listing of all 4 real epics with slug/title/mode, including `standalone-npx` itself showing its own current implementation-loop state (`idle`, current: techlead, next: idle).
- This confirms end-to-end that the published package resolves and runs correctly via `npx`, beyond the local `npm pack`/`publish --dry-run` evidence gathered during task-4's verification.
- No further action required for Phase 2; this closes out the loop's manual-publish dependency.

## 2026-10-02T12:03:48+00:00 - done (uncommitted at time of writing)

- Phase: out-of-loop (between phase-2 and phase-3)
- Task: Distribution foundation: skill wrapper, single version, doctor in CLI, install/update/config, Claude plugin manifests, release script (done in a direct user session, not via the loop)
- Verdict: done (uncommitted at time of writing)
- Changed:
  - plugins/epic-loop/skills/epic-loop/scripts/epic-loop.mjs (new pinned wrapper)
  - packages/cli/src/{cli,paths,skill,config,update-check,invoke,skill-copy,install,status}.mjs
  - packages/cli/src/doctor/* (doctor port + temporary lib duplicates)
  - packages/cli/scripts/build.mjs (version check + skill copy into packages/cli/skill/)
  - packages/cli/package.json (files += skill)
  - packages/cli/pnpm-workspace.yaml (pnpm 11 allowBuilds esbuild only)
  - plugins/epic-loop/.claude-plugin/plugin.json + .claude-plugin/marketplace.json (new)
  - scripts/release.mjs (new) + package.json release script
  - scripts/validate-epic-loop-package.mjs (Claude manifests + version lockstep)
  - SKILL.md + references/hooks-and-session-routing.md (doctor via wrapper, update handling)
  - common.mjs platformSetupCommand text
  - README/AGENTS/CLAUDE/CHANGELOG/packages/cli/README
  - tests/unit/cli-package.test.mjs (new, 11 tests) + updated validation/common/cli-contracts tests
- Verification:
  - pnpm run test:unit 94/94 pass
  - pnpm run validate passes (lint, format, package validation incl. version lockstep)
  - claude plugin validate passes for plugins/epic-loop and the repo marketplace
  - npm pack of packages/cli ships dist + skill (59 files)
  - packed tarball: install --platform claude-code into a fresh git repo copies skill + installs hooks + doctor reports hooks complete
  - update --force swaps the copy atomically
  - real npm registry update check returns latest 0.1.0 and caches it
  - release script dry-run on a temp copy stamps all 5 version files
- Residual risk: Not yet released: the wrapper pins 0.1.0, whose published CLI has no doctor command, so the skill on main is broken for npx users until 0.2.0 is published; runtime copies in this repo were intentionally not self-updated for the same reason. Claude Code / Codex plugin installs were validated by manifest only, not installed end-to-end.
- Next move: User: pnpm run release 0.2.0, npm publish, commit + tag + push; then self-update runtime copies. Then resume the roadmap at Phase 3 with the adjusted tasks.
