# epic-loop

> A Codex plugin for running long autonomous engineering epics without losing the plot.

`epic-loop` turns a large feature, migration, or investigation into a durable epic workspace with explicit lifecycle modes, disk-backed state, and a hook-driven implementation loop. It packages one reusable Codex skill under `plugins/epic-loop/`.

## The Problem

Long autonomous coding sessions often need repeated human coordination:

- deciding whether the previous step is actually complete
- choosing and scoping the next task
- writing a precise implementation brief
- preserving intent, decisions, risks, and progress across sessions
- recovering after context compaction or interruption

`epic-loop` makes that orchestration explicit and durable.

## How Implementation Works

Implementation mode runs as a single Codex session with two visible roles. The Stop hook keeps the loop moving: each techlead turn uses a fixed governance prompt, and each engineer turn receives the task-specific brief the techlead wrote for that exact slice.


**Techlead role.** Owns the implementation loop. It reads compact epic state and live repository evidence, reviews the latest engineer report, decides whether work is honestly closed, chooses the next step, updates human-facing epic artifacts, makes commit decisions, and writes exactly one focused engineer brief when implementation should continue.

**Engineer role.** Owns execution of one concrete brief. It follows project patterns, keeps scope narrow, makes local implementation decisions inside the brief, verifies the result with real evidence, reports changed files, blockers, and gaps, then stops. Routing returns to techlead automatically.

Each epic lives in the target project at `.epic-loop/epics/<slug>/`. Human-facing files preserve state, tracker, implementation notes, decisions, risks, and docs. Hidden `.runtime/` files support hook routing and debugging without becoming default role context.

## Modes

- **Shaping**: clarify the epic, capture intent, create docs, decompose phases and tasks.
- **Implementation**: run the hook-driven techlead/engineer loop.
- **Review**: check completed work against original intent, not only the latest docs.
- **Reset**: replace stale architecture, roadmap, or assumptions with a controlled new baseline.
- **Resume**: re-enter an existing epic from disk-backed artifacts.

## Requirements

- Codex with hooks support.
- Codex hooks enabled under `[features]` in the active config or profile.
- Trusted project-local command hooks for the current session.
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

After installing the plugin, start a new Codex thread and invoke `epic-loop`. The first run checks whether the target project has the project-local hooks it needs.

Hook setup is intentionally performed from the target project after user approval:

```bash
# Check technical readiness.
node <skill-dir>/scripts/doctor.mjs --json

# Install project-local Codex hooks.
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

Human-facing artifacts and machine runtime are separated by design. Roles read the human-facing files. Runtime traces exist for debugging and replay without polluting normal role context.

## Useful Commands

```bash
# Validate this plugin repository.
pnpm run validate

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
