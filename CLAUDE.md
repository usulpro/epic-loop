# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This is the **development repository for the `epic-loop` skill/plugin itself** — not a project that consumes it. `epic-loop` orchestrates long-lived, autonomous engineering epics across sessions via lifecycle modes, disk-backed state, and a Stop-hook-driven manager/techlead/engineer implementation loop.

The distributable surface is `plugins/epic-loop/`; the reusable skill source is `plugins/epic-loop/skills/epic-loop/`.

## Source vs. runtime copies (read this first)

The skill exists in **two kinds of location**, and confusing them wastes time:

- **`plugins/epic-loop/skills/epic-loop/**` — the git-tracked source of truth.** Edit here. Unit tests import from here (`tests/unit/test-utils.mjs` sets `scriptsRoot` to this path).
- **`.claude/skills/epic-loop/**` and `.codex/skills/epic-loop/**` — gitignored runtime copies** that are actually loaded by live agents. The installed Claude Code Stop hook executes `.claude/skills/epic-loop/scripts/hook.mjs`. These may lag the source.

`scripts/self-update-skill.mjs` (`pnpm run self-update`) **wipes and recopies `plugins/ → .claude/ + .codex/`**. Workflow: edit `plugins/`, run unit tests, then `pnpm run self-update` to deploy, then confirm `diff -rq .claude/skills/epic-loop plugins/epic-loop/skills/epic-loop` is clean (excluding `.runtime`). Editing a runtime copy directly makes live runs work but is invisible to git and gets clobbered on the next sync.

The runtime copies are used both for dogfooding epics inside this repo and for **eval-testing the skill** — the epic under `.epic-loop/epics/eval-fixture/` exists to run the skill end-to-end through agents and observe behavior. Never commit anything under `.claude/`, `.codex/`, or `.epic-loop/` (all gitignored runtime/eval artifacts).

## Commands

```bash
pnpm run test:unit          # run all unit tests (node --test)
node --test tests/unit/hook-contracts.test.mjs             # run one test file
node --test --test-name-pattern "reentry continues" tests/unit/hook-contracts.test.mjs  # run one test by name
pnpm run validate           # node --check every script + validate-epic-loop-package.mjs
pnpm run self-update        # sync plugins/ -> .claude/ + .codex/ runtime copies
pnpm run eval-fixture-reset # reset the eval-fixture epic to a clean baseline
node plugins/epic-loop/skills/epic-loop/scripts/doctor.mjs --platform claude-code --json  # hook readiness
```

Tests use only the Node built-in test runner (no Jest/Vitest); each test spawns the real scripts via `runNodeScript` against a temp project root, so they exercise CLI + hook contracts end-to-end.

## Architecture

**Platform abstraction.** The skill supports two host platforms, **Codex** and **Claude Code**, selected explicitly via `doctor.mjs --platform` (written to `.epic-loop/.runtime/platform.json`). Scripts must read the configured platform, never infer it from payload shape, cwd, or environment. `install-hooks.mjs` writes platform-appropriate hook config (`.codex/hooks.json` for Codex, `.claude/settings.json` for Claude Code).

**Hook entry point.** `scripts/hook.mjs` reads a JSON hook payload on stdin and delegates to `lib/hooks.mjs → handleHook`. Hooks fire on `SessionStart`, `UserPromptSubmit`, and `Stop`. **Unbound sessions are silent no-ops** — a session only produces epic-loop state after `bind-session.mjs` records it in `.epic-loop/.runtime/session-bindings.json` (keyed by `session_id`, with an `active_sessions` map so parallel sessions in one project route correctly).

**The implementation loop (`lib/loop.mjs`).** This is the core. Implementation runs as a single agent session cycling roles `manager → techlead → engineer → techlead → …`, driven by a `next_role` state machine persisted in `.epic-loop/epics/<slug>/.runtime/runtime-state.json` under `implementation_loop`. On each `Stop` event, `maybeBuildImplementationContinuation` records the finishing role's report and returns `{ "decision": "block", "reason": "<next role prompt>" }`, which forces the agent to keep working as the next role instead of stopping. Role prompts come from `assets/templates/*` (manager, techlead) or a techlead-authored engineer brief. Techlead advances the machine by calling `set-next-role.mjs`.

**Claude Code Stop-hook block cap.** Claude Code honours repeated `decision: block` continuations within one user turn up to `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` (default 8, `0` = uncapped and recommended). `stop_hook_active` is informational, **not** a gate. `loop.mjs` tracks a per-turn consecutive-block count (reset on a fresh turn), chains roles automatically while uncapped, and near a finite cap does one final manager housekeeping turn then pauses cleanly, asking the user to send `continue loop mode`. See `references/hooks-and-session-routing.md` and `references/implementation-cycle.md`.

**State separation.** In a target project, each epic at `.epic-loop/epics/<slug>/` splits **human-facing artifacts** (`state-of-epic.md`, `tracker.md`, `implementation-log.md`, `decision-log.md`, `risk-register.md`, `docs/`) from machine `.runtime/` traces (hook events, prompt/progress logs, runtime state). Roles read human-facing files; `.runtime/**` is for routing and debugging and must not become default role context.

**Deterministic mechanical changes go through scripts, not hand edits.** `start-task`/`close-task`/`set-task-status`/`start-phase`/`close-phase` mutate roadmap/tracker state; `append-implementation-log`, `write-engineer-brief`, `role-summary`, `render-tracker`, `rebuild-progress` produce or summarize artifacts. `tracker.md` is the source of truth for visible task order.

**`scripts/lib/` modules:** `common.mjs` (paths, platform config, JSON/runtime helpers), `hooks.mjs` (hook install/doctor/dispatch), `loop.mjs` (implementation loop + block-cap logic), `roadmap.mjs` (phase/task state), `epics.mjs` (epic init/listing), `briefs.mjs` (engineer briefs), `implementation-log.mjs`, `summaries.mjs`, `debug.mjs`. Detailed mode/role behavior lives in `skills/epic-loop/references/*.md`; keep `SKILL.md` compact and push depth into references.

## Conventions

- Small, deterministic Node `.mjs` scripts with no runtime dependencies (Node built-ins only).
- Keep this repo shaped as a public plugin/skill package; do not add sample application code unless a plugin behavior test needs it.
- After changing hook/loop behavior, update the matching `hook-contracts.test.mjs` / `cli-contracts.test.mjs` contracts and the affected `references/*.md`, then `self-update`.
