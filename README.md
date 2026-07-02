# epic-loop

> A Codex and Claude Code plugin for shaping an engineering epic, then running long autonomous implementation against it, without losing the plot.

An **epic** is the unit of planning: a large slice of work (a feature, migration, or investigation). The name is borrowed from agile decomposition (a large body of work broken into tasks), but here an epic is an area of project ownership with a bounded context: you can rejoin it from any session, and keep it for as long as you need it.

`epic-loop` turns that epic into a durable workspace. You first *shape* it (capture intent, decompose into phases and tasks), then run *implementation* against it through a hook-driven loop. Explicit lifecycle modes and disk-backed state carry the epic across sessions. It packages one reusable skill under `plugins/epic-loop/` that runs on both Codex and Claude Code.

## The Problem

Long autonomous coding sessions often need repeated human coordination:

- deciding whether the previous step is actually complete
- choosing and scoping the next task
- writing a precise implementation brief
- preserving intent, decisions, risks, and progress across sessions
- recovering after context compaction or interruption

`epic-loop` makes that orchestration explicit and durable.

## How Shaping Works

Shaping is a rhythmic dialogue, not a one-shot planning dump. The agent clarifies intent topic by topic, captures it in the epic's documentation pack, and decomposes the work into phases and tasks with concrete acceptance criteria. The tracker and docs it produces are exactly what the implementation loop later consumes — shaping is where the epic's roadmap and source of truth come from.

## How Implementation Works

Implementation mode runs as a single agent session (Codex or Claude Code) with two visible roles. The Stop hook keeps the loop moving: each techlead turn uses a fixed governance prompt, and each engineer turn receives the task-specific brief the techlead wrote for that exact slice.


**Techlead role.** Owns the implementation loop. It reads compact epic state and live repository evidence, reviews the latest engineer report, decides whether work is honestly closed, chooses the next step, updates human-facing epic artifacts, makes commit decisions, and writes exactly one focused engineer brief when implementation should continue.

**Engineer role.** Owns execution of one concrete brief. It follows project patterns, keeps scope narrow, makes local implementation decisions inside the brief, verifies the result with real evidence, reports changed files, blockers, and gaps, then stops. Routing returns to techlead automatically.

Each epic lives in the target project at `.epic-loop/epics/<slug>/`. Human-facing files preserve state, tracker, implementation notes, decisions, risks, and docs. Hidden `.runtime/` files support hook routing and debugging without becoming default role context.

## Modes

The spine is two ordered modes — first you shape the epic, then you implement it:

1. **Shaping** → clarify the epic, capture intent, create docs, decompose into phases and tasks.
2. **Implementation** → run the hook-driven techlead/engineer loop against those tasks.

Three supporting modes surround that axis:

- **Review**: check completed work against original intent, not only the latest docs.
- **Reset**: replace stale architecture, roadmap, or assumptions with a controlled new baseline.
- **Resume**: re-enter an existing epic from disk-backed artifacts.

## Requirements

- A supported host: **Codex** (with hooks enabled under `[features]` in the active config or profile) **or Claude Code**.
- Trusted project-local command hooks for the current session (`.codex/hooks.json` for Codex, `.claude/settings.json` for Claude Code).
- Node.js for the bundled `.mjs` helper scripts.
- A target repository where the epic workspace should be created.

## Repository Layout

```text
marketplace.json
plugins/
  epic-loop/
    .codex-plugin/plugin.json
    skills/
      epic-loop/
        SKILL.md
        agents/openai.yaml
        scripts/
        references/
        assets/templates/
scripts/
  validate-epic-loop-package.mjs
```

The distributable plugin surface is `plugins/epic-loop/`. The root `marketplace.json` exposes that plugin for local or Git-backed marketplace installation.

## Installation

Add this repository as a Codex plugin marketplace:

```bash
codex plugin marketplace add <owner>/<repo>
```

For local development from this checkout:

```bash
codex plugin marketplace add .
```

On **Claude Code**, install the plugin through its plugin marketplace, or load the skill directly from `.claude/skills/epic-loop/` (this repo keeps that copy in sync via `pnpm run self-update`).

After installing the plugin, start a new Codex or Claude Code session and invoke `epic-loop`. The first run checks whether the target project has the project-local hooks it needs.

Hook setup is intentionally performed from the target project after user approval:

```bash
# Check technical readiness for the chosen host.
node <skill-dir>/scripts/doctor.mjs --platform codex|claude-code --json

# Install project-local hooks (.codex/hooks.json for Codex, .claude/settings.json for Claude Code).
node <skill-dir>/scripts/install-hooks.mjs

# Bind the current session to an epic after the user confirms implementation.
node <skill-dir>/scripts/bind-session.mjs \
  --current --slug "<epic-slug>" --mode implementation
```

Unbound sessions are silent no-ops. `epic-loop` only activates for sessions explicitly bound to an epic.

## Epic Workspace

Each epic at `.epic-loop/epics/<slug>/` contains:

```text
state-of-epic.md
tracker.md
implementation-log.md
decision-log.md
risk-register.md
docs/
.runtime/
```

These human-facing files **are** the epic — a durable, human-readable planning artifact that lives in the repo, can be committed alongside the code, and outlives any single session. Human-facing artifacts and machine runtime are separated by design: roles read the human-facing files, while runtime traces exist for debugging and replay without polluting normal role context.

## Useful Commands

```bash
# Validate this plugin repository.
pnpm run validate

# Sync the current skill into repo-local Codex and Claude Code skill folders.
pnpm run self-update

# List local epics in a target project.
node <skill-dir>/scripts/list-epics.mjs

# Create a new epic workspace.
node <skill-dir>/scripts/init-epic.mjs \
  --description "<epic description>"

# Show compact role-facing state for an epic.
node <skill-dir>/scripts/role-summary.mjs --slug "<epic-slug>"

# Write an engineer handoff brief.
node <skill-dir>/scripts/write-engineer-brief.mjs \
  --slug "<epic-slug>" --stdin

# Route the next implementation turn.
node <skill-dir>/scripts/set-next-role.mjs \
  --slug "<epic-slug>" --role "<engineer|idle>" \
  --reason "<short reason>"
```

Task and phase scripts are available for deterministic status changes:

```bash
node <skill-dir>/scripts/start-task.mjs --slug "<epic-slug>" --task-id "<task-id>"
node <skill-dir>/scripts/close-task.mjs --slug "<epic-slug>" --task-id "<task-id>"
node <skill-dir>/scripts/start-phase.mjs --slug "<epic-slug>" --phase-id "<phase-id>"
node <skill-dir>/scripts/close-phase.mjs --slug "<epic-slug>" --phase-id "<phase-id>"
node <skill-dir>/scripts/append-implementation-log.mjs --slug "<epic-slug>" --task "<task>" --verdict "<verdict>"
```

## Status

Experimental. The plugin is intended for sustained autonomous engineering work where preserving intent, state, and review discipline matters more than simply running a checklist.

## License

MIT
