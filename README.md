# Epic Loop Development Lab

This repository is a local development and testing lab for the `epic-loop` Codex skill.

The Next.js project in this checkout is only a fixture. It exists so the skill can be tested against a realistic codebase with real files, scripts, routes, components, formatting, typecheck, build output, hooks, dirty state, and long-running implementation sessions. The application itself is not the product of this repository.

This is worth stating plainly:

- the skill is the product
- the fixture app is disposable
- the local epic state is test evidence and runtime support

If the fixture app vanished tomorrow, but the skill became better, the project would still have succeeded.

## Primary Goal

The only valuable product here is the local skill:

```text
.agents/skills/epic-loop/
```

The lab is used to design, implement, and verify:

- long-lived epic workspaces
- project-local Codex hook setup
- session binding and routing
- shaping, implementation, review, and reset modes
- techlead / engineer implementation cycles
- runtime logging and human-facing artifacts
- context-pressure reduction for long autonomous work
- recovery from interrupted or failed sessions

The lab is not used to build a polished standalone application. Any app work here is in service of skill quality.

## Project Model

Treat this repository as three layers:

```text
.agents/skills/epic-loop/   reusable skill source
.epic-loop/                 local test epic workspaces and runtime state
src/, package.json, etc.    disposable Next.js fixture app
```

The skill source is the thing being developed.

The `.epic-loop/` directory is test data and runtime state for exercising the skill. Human-facing epic artifacts may be useful during tests; runtime/debug artifacts are not product work.

The Next.js app is a realistic fixture. Modify it only when a skill test requires real implementation work, diffs, verification, or failure recovery.

## What Success Looks Like

Success in this repository means the following are improving over time:

- long-lived epic work survives session boundaries cleanly
- shaping, implementation, review, and reset remain distinct and legible
- techlead and engineer roles stay behaviorally clean
- mechanical state changes move into scripts and structured state
- runtime/debug traces stay available without polluting normal role context
- the framework remains understandable even as the implementation grows
- context pressure goes down rather than up as the system matures

Success does **not** mean:

- a prettier fixture app
- broader app feature coverage for its own sake
- keeping old experiments alive indefinitely
- preserving technical scaffolding that roles no longer need

## Important Paths

```text
.agents/skills/epic-loop/SKILL.md
.agents/skills/epic-loop/references/
.agents/skills/epic-loop/templates/
.agents/skills/epic-loop/scripts/
.agents/skills/epic-loop/scripts/lib/

.epic-loop/epics/<slug>/
.epic-loop/epics/<slug>/.runtime/
.epic-loop/.runtime/

.codex/hooks.json
```

## Common Skill Commands

Check technical readiness:

```bash
node .agents/skills/epic-loop/scripts/doctor.mjs --json
```

Install project-local hooks:

```bash
node .agents/skills/epic-loop/scripts/install-hooks.mjs
```

List local epics:

```bash
node .agents/skills/epic-loop/scripts/list-epics.mjs --json
```

Bind the current session to an implementation epic:

```bash
node .agents/skills/epic-loop/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

Inspect loop runtime/debug state:

```bash
node .agents/skills/epic-loop/scripts/debug.mjs --json
```

Get compact role-facing state:

```bash
node .agents/skills/epic-loop/scripts/role-summary.mjs --slug "<epic-slug>"
```

## Fixture Commands

Use the fixture app commands only when a test scenario needs app-level verification:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm build
pnpm dev
```

Do not treat fixture app failures as automatically higher priority than skill behavior. First decide whether the failure matters to the current skill test.

## Development Principles

The skill is being designed as an orchestration system, not a document generator.

Core principles:

- Keep long-lived epic intent recoverable across sessions.
- Separate human-facing truth from machine/runtime traces.
- Prefer script-driven deterministic transitions over model-edited mechanical markdown.
- Keep engineer turns skill-agnostic.
- Keep techlead turns responsible for orchestration, closure, task selection, phase state, commits, and review.
- Make hooks project-local and opt-in by session.
- Treat unbound sessions as silent no-ops.
- Optimize for context hygiene in long-running loops.
- Preserve rich debug data without making it part of normal role-facing reads.
- Avoid compatibility layers, migrations, and fallback support unless explicitly requested for the current design step.

Two principles matter especially in this lab:

### 1. Behavior First

The most important thing is how the agent behaves over time:

- what it reads
- what it ignores
- how it closes work
- how it decides to continue, question, review, or reset
- how much context it consumes to stay effective

Prompting quality, role clarity, and orchestration discipline are first-class design concerns.

### 2. Infrastructure Supports Behavior

Scripts, runtime state, and hidden debug traces matter only insofar as they support the intended behavior of the skill.

Good infrastructure should:

- reduce context pressure
- reduce manual markdown patching
- reduce role confusion
- make truth easier to preserve
- stay mostly invisible to engineer-facing work

If infrastructure starts leaking into normal role prompts or normal role reading paths, that is a design problem, not just a technical inconvenience.

## Runtime And Git Hygiene

Runtime/debug artifacts should stay hidden from normal work:

```text
.epic-loop/.runtime/
.epic-loop/epics/*/.runtime/
```

Normal role-facing epic files are:

```text
state-of-epic.md
tracker.md
implementation-log.md
decision-log.md
risk-register.md
docs/**
```

When testing produces noisy runtime files, prefer changing the skill so runtime data is routed correctly instead of manually curating noise.

Human-facing truth and machine-facing runtime data should remain separate. That separation is part of the product design of `epic-loop`, not just a repository cleanup preference.

## What Not To Do

- Do not turn the fixture app into a product.
- Do not optimize the Next.js app unless the skill test requires it.
- Do not put internal development policy into reusable skill docs unless that policy is part of the user-facing skill behavior.
- Do not add Python scripts for the skill; use Node.js.
- Do not rely on chat memory as the durable source of epic state.
- Do not make engineer prompts aware of epic-loop routing, tracker closure, or hook mechanics.
- Do not read prompt/progress logs in normal implementation flow; use compact summaries.

Also avoid:

- treating technical debug traces as normal source-of-truth for role behavior
- solving prompting problems only with more scripts
- solving infrastructure problems only with more prompt text

This lab exists to find the right boundary between the two.

## Current Status

This lab is intentionally experimental. The skill is still evolving, and test epics may contain interrupted sessions, stale artifacts, and partially migrated runtime data. Treat those as test material for improving `epic-loop`, not as application backlog.

The repository should gradually become better at:

- preserving intent
- preserving truth
- preserving role clarity
- preserving context budget

Those are the real quality axes here.
