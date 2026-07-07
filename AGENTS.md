# Agent Instructions

This repository publishes and validates the `epic-loop` plugin/skill for both Codex and Claude Code.

The durable product surface is:

```text
plugins/epic-loop/
```

The reusable skill source is:

```text
plugins/epic-loop/skills/epic-loop/
```

## Development Focus

- Keep the repository shaped as a public plugin/skill package.
- Prefer small, deterministic Node.js scripts for mechanical state changes.
- Keep skill instructions compact and use references for detailed mode behavior.
- Do not add sample application code unless it is explicitly needed for a plugin behavior test.
- Do not commit local runtime state, hook captures, prompt logs, or target-project epic workspaces.

## Runtime Layout

When the skill runs in a target project, human-facing epic artifacts live under:

```text
.epic-loop/epics/<slug>/
```

Per-epic runtime/debug artifacts belong under:

```text
.epic-loop/epics/<slug>/.runtime/
```

Global session and hook runtime belongs under:

```text
.epic-loop/.runtime/
```

Runtime/debug files should not be committed to this plugin repository.

## Local Epic Runtime Operation

This checkout can also run its own local epics. Treat the local epic runtime as a consumer of an installed skill, not as the source package under development.

Installed runtime skill copies are separate from source:

```text
.codex/skills/epic-loop/       # Codex runtime skill copy
.claude/skills/epic-loop/      # Claude Code runtime skill copy, when present
```

When an epic is invoked through an installed skill, runtime commands must use the same installed skill directory that contains the invoked `SKILL.md`. Do not substitute the source package path for runtime operations.

For Codex local epic runtime in this repository:

```bash
node .codex/skills/epic-loop/scripts/doctor.mjs --platform codex --json
node .codex/skills/epic-loop/scripts/install-hooks.mjs
node .codex/skills/epic-loop/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

For Claude Code local epic runtime in this repository:

```bash
node .claude/skills/epic-loop/scripts/doctor.mjs --platform claude-code --json
node .claude/skills/epic-loop/scripts/install-hooks.mjs
node .claude/skills/epic-loop/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

If the matching installed skill copy is missing, do not silently fall back to `plugins/epic-loop/skills/epic-loop`. Report the missing runtime skill copy and ask before changing runtime setup.

Runtime commands include:

- hook readiness checks intended to assess the active local epic runtime
- hook install or repair commands
- session bind/unbind commands
- implementation loop role and tracker state commands for active local epics

Do not run `install-hooks.mjs` from `plugins/epic-loop/skills/epic-loop` to repair active local runtime hooks unless the user explicitly wants to test the mutable source package as the live runtime.

## Hook And Session Rules

The skill installs project-local hooks in the target project — `.codex/hooks.json` for Codex, `.claude/settings.json` for Claude Code:

```text
.codex/hooks.json      # Codex
.claude/settings.json  # Claude Code
```

The hook target is:

```bash
node <skill-dir>/scripts/hook.mjs
```

For local runtime epics in this repository, `<skill-dir>` is the installed runtime skill directory, such as `.codex/skills/epic-loop` or `.claude/skills/epic-loop`, not `plugins/epic-loop/skills/epic-loop`.

Required hook events:

- `SessionStart`
- `UserPromptSubmit`
- `Stop`

The runtime platform is selected explicitly (never inferred from payload shape, cwd, or environment) and stored in `.epic-loop/.runtime/platform.json`. Always run readiness checks through the matching platform:

```bash
node <runtime-skill-dir>/scripts/doctor.mjs --platform codex|claude-code --json
```

Only bound sessions may write epic-loop runtime state. Unbound sessions must produce no epic-loop records.

## Implementation Loop Rules

Implementation starts only after explicit user confirmation in the current session.

Binding command:

```bash
node <runtime-skill-dir>/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

After binding, stop the current user turn. The `Stop` hook should continue with the first manager turn.

Techlead owns orchestration decisions, tracker state, closure decisions, implementation log entries, decision and risk updates, commit decisions, and engineer briefs.

Engineer owns one concrete brief, relevant code changes, verification, and a final report. Engineer must not receive routing instructions, tracker closure instructions, hook commands, or role mechanics.

## Required Script-Driven Operations

Use installed runtime skill scripts for mechanical state changes in active local epics:

```bash
node <runtime-skill-dir>/scripts/start-task.mjs --slug "<slug>" --task-id "<task-id>"
node <runtime-skill-dir>/scripts/close-task.mjs --slug "<slug>" --task-id "<task-id>"
node <runtime-skill-dir>/scripts/set-task-status.mjs --slug "<slug>" --task-id "<task-id>" --status "<status>"
node <runtime-skill-dir>/scripts/start-phase.mjs --slug "<slug>" --phase-id "<phase-id>"
node <runtime-skill-dir>/scripts/close-phase.mjs --slug "<slug>" --phase-id "<phase-id>"
node <runtime-skill-dir>/scripts/append-implementation-log.mjs --slug "<slug>" --task "<task>" --verdict "<verdict>"
node <runtime-skill-dir>/scripts/write-engineer-brief.mjs --slug "<slug>" --stdin
node <runtime-skill-dir>/scripts/role-summary.mjs --slug "<slug>"
```

Avoid hand-editing generated tracker state, runtime state, or large implementation logs for mechanical transitions.

## Source Package Development

Source files under `plugins/epic-loop/skills/epic-loop/` are the package being developed. Editing them must not automatically change the installed runtime skill copies or active local hooks.

Use source-package scripts only for package development, validation, and tests:

```bash
node plugins/epic-loop/skills/epic-loop/scripts/doctor.mjs --platform codex --json
node plugins/epic-loop/skills/epic-loop/scripts/doctor.mjs --platform claude-code --json
pnpm run validate
```

When run from the source package, `doctor.mjs` and `install-hooks.mjs` compute hook targets relative to `plugins/epic-loop/skills/epic-loop`. A source-package doctor may report installed runtime hooks as stale. During normal local epic runtime operation, do not treat that as permission to repair hooks from the source package.

Only use source-package `install-hooks.mjs` when deliberately testing the source package as the live runtime, and only after explicit user confirmation.

## Manual Runtime Skill Update

Updating installed runtime skill copies from source is an explicit manual promotion step, not an automatic agent repair.

After source changes are complete and validated, the user may choose to run:

```bash
node scripts/self-update-skill.mjs
```

This script syncs `plugins/epic-loop/skills/epic-loop` into the installed Codex and Claude Code skill locations. Agents must not run this script proactively during implementation unless the user explicitly asks to update the installed runtime skills.

After a manual runtime skill update, run runtime hook readiness from the installed skill copy and reinstall hooks from that same installed copy if needed.

## Source Verification

For plugin and skill script changes:

```bash
pnpm run validate
```

For source package readiness in this checkout:

```bash
node plugins/epic-loop/skills/epic-loop/scripts/doctor.mjs --platform codex|claude-code --json
```

## Context Hygiene

Do not read large runtime logs in normal flow:

- prompt logs
- progress logs
- hook event dumps
- session debug traces
- full transcript files

Use compact scripts and targeted reads instead.
