# Agent Instructions

This repository publishes and validates the `epic-loop` Codex plugin.

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

## Hook And Session Rules

The skill installs project-local hooks in the target project:

```text
.codex/hooks.json
```

The hook target is:

```bash
node <skill-dir>/scripts/hook.mjs
```

Required hook events:

- `SessionStart`
- `UserPromptSubmit`
- `Stop`

Always run readiness checks through:

```bash
node plugins/epic-loop/skills/epic-loop/scripts/doctor.mjs --json
```

Only bound sessions may write epic-loop runtime state. Unbound sessions must produce no epic-loop records.

## Implementation Loop Rules

Implementation starts only after explicit user confirmation in the current session.

Binding command:

```bash
node plugins/epic-loop/skills/epic-loop/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

After binding, stop the current user turn. The `Stop` hook should continue with the first manager turn.

Techlead owns orchestration decisions, tracker state, closure decisions, implementation log entries, decision and risk updates, commit decisions, and engineer briefs.

Engineer owns one concrete brief, relevant code changes, verification, and a final report. Engineer must not receive routing instructions, tracker closure instructions, hook commands, or role mechanics.

## Required Script-Driven Operations

Use scripts for mechanical state changes:

```bash
node plugins/epic-loop/skills/epic-loop/scripts/start-task.mjs --slug "<slug>" --task-id "<task-id>"
node plugins/epic-loop/skills/epic-loop/scripts/close-task.mjs --slug "<slug>" --task-id "<task-id>"
node plugins/epic-loop/skills/epic-loop/scripts/set-task-status.mjs --slug "<slug>" --task-id "<task-id>" --status "<status>"
node plugins/epic-loop/skills/epic-loop/scripts/start-phase.mjs --slug "<slug>" --phase-id "<phase-id>"
node plugins/epic-loop/skills/epic-loop/scripts/close-phase.mjs --slug "<slug>" --phase-id "<phase-id>"
node plugins/epic-loop/skills/epic-loop/scripts/append-implementation-log.mjs --slug "<slug>" --task "<task>" --verdict "<verdict>"
node plugins/epic-loop/skills/epic-loop/scripts/write-engineer-brief.mjs --slug "<slug>" --stdin
node plugins/epic-loop/skills/epic-loop/scripts/role-summary.mjs --slug "<slug>"
```

Avoid hand-editing generated tracker state, runtime state, or large implementation logs for mechanical transitions.

## Verification

For plugin and skill script changes:

```bash
pnpm run validate
```

For hook readiness in this checkout:

```bash
node plugins/epic-loop/skills/epic-loop/scripts/doctor.mjs --json
```

## Context Hygiene

Do not read large runtime logs in normal flow:

- prompt logs
- progress logs
- hook event dumps
- session debug traces
- full transcript files

Use compact scripts and targeted reads instead.
