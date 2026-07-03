# epic-loop

> A Codex and Claude Code plugin for shaping an engineering epic, then running long autonomous implementation against it, without losing the plot.

An **epic** is the unit of planning: a large slice of work, such as a new area of functionality, a complex migration, or an open-ended investigation. The name comes from agile, where an epic is a large body of work broken into smaller tasks. Here, it's an area of project ownership with its own bounded context, one you can rejoin from any session and keep for as long as you need it.

`epic-loop` turns that epic into a durable workspace. You first *shape* it, capturing intent and decomposing the work into phases and tasks, then run *implementation* against it through a hook-driven loop. Explicit lifecycle modes and disk-backed state carry the epic across sessions.

## The Problem

Working with coding agents produces a second body of work alongside the code: the intent, specs, decisions, and task breakdowns you feed the agent. Today it has nowhere durable to live.

- context evaporates between sessions, machines, and teammates, or bloats a single `AGENTS.md` / `CLAUDE.md`
- you return to *areas*, not tasks: cross-cutting, revisited weeks apart, reconstructed by hand each time
- inside a long autonomous run, coordination falls back on you: is the last step done, what to scope next, what goes in each brief
- a compaction or interruption loses the thread

`epic-loop` gives that work a home and makes the orchestration explicit and durable.

## How to install

**As Codex Plugin:**

in your terminal:

```console

codex plugin marketplace add usulpro/epic-loop
codex plugin add epic-loop@epic-loop

```

then in codex:

```
`$epic-loop start a new epic`
```

## How Shaping Works

Shaping is a step-by-step dialogue, not a one-shot planning dump. The agent clarifies intent topic by topic, captures it in the epic's documentation pack, and decomposes the work into phases and tasks with concrete acceptance criteria. The tracker and docs it produces are exactly what the implementation loop later consumes: shaping is where the epic's roadmap and source of truth come from.

## How Implementation Works

Implementation mode runs as a single agent session (Codex or Claude Code) with two visible roles. The Stop hook keeps the loop moving: each techlead turn uses a fixed governance prompt, and each engineer turn receives the task-specific brief the techlead wrote for that exact slice.

**Techlead role.** Owns the implementation loop. It reads compact epic state and live repository evidence, reviews the latest engineer report, decides whether work is honestly closed, chooses the next step, updates human-facing epic artifacts, makes commit decisions, and writes exactly one focused engineer brief when implementation should continue.

**Engineer role.** Owns execution of one concrete brief. It follows project patterns, keeps scope narrow, makes local implementation decisions inside the brief, verifies the result with real evidence, reports changed files, blockers, and gaps, then stops. Routing returns to techlead automatically.

## Modes

Two ordered modes. First you shape the epic, then you implement it:

1. **Shaping** → clarify the epic, capture intent, create docs, decompose into phases and tasks.
2. **Implementation** → run the hook-driven techlead/engineer loop against those tasks.

Supporting workflows help keep long-lived epics healthy:

- **Review** → check completed work against the original intent and captured decisions.
- **Reset** → replace stale assumptions, architecture, or roadmap with a controlled new baseline.
- **Resume** → re-enter an existing epic from its disk-backed workspace.

## The Epic Workspace

Epics live inside the target project under `.epic-loop/`, each keyed by a `<slug>` that names its folder and is passed to helper scripts via `--slug`. Multiple epics can coexist, each self-contained.

```text
.epic-loop/
  epics/
    <slug>/                 # one self-contained epic
      state-of-epic.md      # compact, current source of truth
      tracker.md            # phases and tasks with their status
      implementation-log.md # what each turn changed, with verdicts
      decision-log.md       # decisions by you and the agent, with rationale
      risk-register.md      # known risks and open concerns
      docs/                 # intent, specs, references captured during shaping
      .runtime/             # hidden machine state for hook routing and replay
    <another-slug>/         # another epic, same layout
```

These files **are** the epic: a durable, human-readable planning artifact you commit alongside the code and keep across sessions. Roles read the human-facing files; `.runtime/` exists for debugging and replay without polluting role context.

## Requirements

- A supported host: **Codex** (with hooks enabled under `[features]` in the active config or profile) **or Claude Code**.
- Trusted project-local command hooks for the current session (`.codex/hooks.json` for Codex, `.claude/settings.json` for Claude Code).
- Node.js for the bundled `.mjs` helper scripts.
- A target repository where the epic workspace should be created.

## Installation

Add this repository as a Codex plugin marketplace and install the plugin:

```bash
codex plugin marketplace add usulpro/epic-loop --ref main
codex plugin add epic-loop@epic-loop
```

To install a pinned version, use the release tag or commit ref:

```bash
codex plugin marketplace add usulpro/epic-loop --ref "<ref>"
codex plugin add epic-loop@epic-loop
```

For local development from this checkout:

```bash
codex plugin marketplace add .
codex plugin add epic-loop@epic-loop
```

On **Claude Code**, install the plugin through its plugin marketplace, or load the skill directly from `.claude/skills/epic-loop/` (this repo keeps that copy in sync via `pnpm run self-update`).

After installing the plugin, start a new Codex or Claude Code session in the target repository and invoke the skill by name:

```text
$epic-loop start a new epic for the following area of functionality:
[describe the problem area or functionality you need to solve]

$epic-loop <epic-slug|epic-path>

$epic-loop <epic-slug|epic-path> start implementation loop

$epic-loop <epic-slug|epic-path> start review mode
```

The first run checks whether the target project has the project-local hooks it needs.

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

## Status

Experimental. The plugin is intended for sustained autonomous engineering work where preserving intent, state, and review discipline matters more than simply running a checklist.

## Development

For contributors working on the plugin itself.

### Repository Layout

```text
.agents/
  plugins/
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

The distributable plugin surface is `plugins/epic-loop/`. The `.agents/plugins/marketplace.json` file exposes that plugin for local or Git-backed marketplace installation.

### Repository Commands

```bash
# Validate this plugin repository.
pnpm run validate

# Sync the current skill into repo-local Codex and Claude Code skill folders.
pnpm run self-update
```

### Helper Scripts

These scripts back the modes above. In normal use the agent invokes them through hooks; they are listed here for reference and manual debugging.

```bash
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

## License

MIT
