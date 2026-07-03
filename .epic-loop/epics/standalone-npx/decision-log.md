# Decision Log

## Active Decisions

- **Package location**: `packages/cli` inside this repo, not a separate repository.
- **No pnpm workspace**: `packages/cli` is a self-contained npm package with its own `package.json` and its own install, not a formal pnpm workspace member. Reason: the repo root is a private plugin/skill distribution, not a code package, so there is currently no second package to justify workspace tooling (shared deps, `workspace:*` protocol, hoisting). Revisit only if a genuine second package or shared-dependency need appears later.
- **Package name**: `epic-loop`, published publicly to npm. Confirmed available on the registry (`npm view epic-loop` returned 404) as of 2026-07-04.
- **Publish model (Phase 2)**: manual `npm publish`, executed by the user themselves. No CI-based release automation in this epic's scope.
- **Starting language**: plain JavaScript (ESM), matching the rest of the repo. Explicitly not a hard constraint — Phase 3 may adopt TypeScript if the chosen CLI/TUI stack benefits from it; that move is not to be treated as scope creep or a later "reset."
- **Dependency policy**: `packages/cli` may take on npm runtime dependencies (CLI parsing, output styling, TUI libraries). This differs from the skill's own `scripts/*.mjs` convention (Node built-ins only) — that convention applies to the skill scripts, not to this published package.
- **Phase 5 / eval-metrics coordination**: coordinate with the existing `test-coverage` epic instead of building an independent eval-fixture harness. `test-coverage`'s Phase 2 (not yet started) already targets an eval-fixture pipeline; this epic's Phase 5 reuses/extends that work rather than duplicating it. Exact coordination mechanics (ownership, hand-off point) to be worked out when Phase 5 actually starts.
- **Roadmap shape**: Phase 1 is the standard "shape the epic" phase; the user's four described phases became Phases 2-5 — (2) bootstrap + zero-arg status command + manual publish, (3) CLI/TUI stack research with competing prototypes and a user-reviewed pick, (4) full user command surface research/spec/implementation/testing, (5) skill migration from scripts to CLI with before/after eval metrics driving an adopt/drop/iterate decision.

- **Implementation run scope (2026-07-04)**: user explicitly started the implementation loop but scoped this session to Phase 2 only ("run implementation loop but only do the first phase, then stop"). techlead must not advance into Phase 3 after Phase 2 closes; set `next_role idle` after Phase 2's phase-closure housekeeping instead.

## Phase 2 Closure Review (2026-07-04)

- Phase goal ("bootstrap the package and ship the zero-arg status command") is honestly met: `packages/cli` installs independently, builds via `pnpm run build` into a gitignored `dist/`, and the zero-arg command finds the project root by walking up from `cwd` and lists real epics with mode/implementation-loop state.
- All four tracker tasks closed with task-owned commits (`a9eaef0`, `ebe3b2b`, `f3fa046`, `dc05107`); the phase's `verification` task (task 4) produced real evidence (three fixture scenarios, `npm pack`/`publish --dry-run`) and caught a real defect (invalid `bin` path), which was fixed and re-verified.
- Gap found and not blocking: every Phase 2 task referenced `docs/bootstrap.md`, but it was never written (task detail lived inline in `tracker.md` instead). Recorded as `follow-up-01` in `tracker.md` rather than reopening a closed task or expanding this run's scope.
- Phase 1 outputs (problem framing, locked decisions) were consumed correctly — no drift found between what was decided in shaping and what got built.
- Next-phase seam check: Phase 3 (CLI/TUI stack research + prototypes) builds directly on this bootstrap/build foundation. The build pipeline (`src/` -> `dist/` via esbuild) and the plain-JS starting point were both explicitly designed to not constrain Phase 3's stack choice — no rework expected when Phase 3 starts.
- Verdict: **close the phase, with the one explicit follow-up above** (not blocking, not urgent).

## Historical Decisions

- None recorded yet.
