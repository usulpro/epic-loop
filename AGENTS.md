# Agent Instructions

This project exists exclusively to develop and test the local `epic-loop` Codex skill.

The Next.js application in this repository is only a realistic fixture. It provides a real codebase for exercising long-running autonomous work, hooks, routing, implementation cycles, diffs, verification, and recovery. Do not treat the app as the product.

The skill is the product.
The fixture app is disposable test material.
The local `.epic-loop/` state is evidence and runtime support for improving the skill.

## Primary Objective

Your main responsibility in this repository is to improve, test, and reason about:

```text
.agents/skills/epic-loop/
```

Prioritize skill behavior over fixture application polish.

If there is tension between:

- making the fixture app nicer
- making epic-loop more correct, more reliable, or more context-efficient

always choose epic-loop.

## Mental Model

There are three different surfaces:

- `Skill source`: `.agents/skills/epic-loop/**`
- `Epic test state`: `.epic-loop/**`
- `Fixture app`: `src/**`, `package.json`, Next.js config, public assets

The skill source is the durable deliverable.

The epic test state is local evidence and runtime material. Human-facing epic files can be useful for testing. Runtime/debug files are not normal work items.

The fixture app is disposable test substrate. Modify it only when testing an epic-loop behavior requires real implementation work.

When in doubt, ask:

- Is this improving the reusable skill?
- Is this only improving the local fixture?
- Is this runtime plumbing that supports the skill but should not leak into role-facing behavior?

## Conceptual Principles

`epic-loop` is an orchestration skill for sustained epic-level work. It should help an agent act as a long-lived technical lead, execution coordinator, engineer handoff writer, reviewer, and process keeper across multiple sessions.

Follow these principles:

- Preserve original intent, not just the latest written checklist.
- Make re-entry cheap and reliable after session breaks.
- Convert discussion into durable artifacts gradually.
- Keep shaping, implementation, review, and reset as distinct lifecycle modes.
- Keep the implementation loop explicit: `techlead -> engineer -> techlead`.
- Give techlead responsibility for orchestration decisions.
- Give engineer only a normal engineering task brief.
- Make deterministic state changes through scripts, not broad model-edited markdown.
- Separate human-facing truth from runtime/debug traces.
- Keep hooks project-local and session-bound.
- Treat unbound sessions as silent no-ops.
- Design for parallel sessions without cross-session signal confusion.
- Reduce context pressure as a first-class architecture requirement.
- Preserve enough debug data to investigate failures without making debug logs part of normal role context.

Additional guiding principles:

- The real deliverable is not only code that works, but an agent workflow that keeps working across long sessions.
- Prompting behavior and technical infrastructure are different layers; both matter, but they should not be conflated.
- Role behavior should stay conceptually clean even when technical plumbing underneath it grows more capable.
- The engineer role should feel like a normal engineering worker, not like a framework operator.
- The techlead role should own truth management, closure, direction, and handoff quality.
- Runtime/debug traces exist to debug the framework, not to become default input to the roles.
- Context economy is part of product quality: if the skill works only by re-reading everything every turn, the design is still incomplete.
- The fixture should be realistic enough to stress the skill, but never important enough to distort the skill design around fixture-specific quirks.

## Development Policy

This is an early-stage design lab. Do not add backwards compatibility, legacy shims, migration layers, or fallback support unless Oleg explicitly asks for it.

Prefer direct, simple, current-shape implementations. When the design changes, update the skill and test fixture to the new design instead of supporting both old and new behavior.

Do not put project-internal development policy into reusable skill instructions unless it is part of the intended public skill behavior.

Prefer changing the design cleanly over preserving yesterday's experiment.

If a previous approach is now wrong:

- update the skill
- update the supporting runtime/scripts
- update the lab instructions
- keep only the history needed to explain the change

Do not keep dead design branches alive just because they existed first.

## Skill Implementation Rules

- Use Node.js for skill scripts.
- Do not add Python scripts.
- Keep scripts small and purpose-specific.
- Prefer structured state and deterministic scripts for mechanical operations.
- Keep markdown artifacts readable, but do not make agents patch large markdown files for mechanical state transitions.
- Store machine/runtime artifacts under hidden runtime paths.
- Keep role-facing summaries compact.
- Do not require normal techlead flow to read prompt logs, progress logs, hook events, or session debug traces.

The skill implementation should aim for:

- compact role-facing prompts
- strong role definitions
- deterministic scripted mutations for mechanical state changes
- selective reading of human-facing truth artifacts
- hidden runtime plumbing
- explicit separation between normal flow and debug flow

## Runtime Layout

Human-facing epic artifacts live under:

```text
.epic-loop/epics/<slug>/
```

Expected human-facing files:

```text
state-of-epic.md
tracker.md
implementation-log.md
decision-log.md
risk-register.md
docs/**
```

Per-epic runtime/debug artifacts belong under:

```text
.epic-loop/epics/<slug>/.runtime/
```

Global session and hook runtime belongs under:

```text
.epic-loop/.runtime/
```

Runtime/debug files should not pollute normal `git status`.

## Hook And Session Rules

Hooks are project-local:

```text
.codex/hooks.json
```

The hook target is:

```bash
node .agents/skills/epic-loop/scripts/hook.mjs
```

Required hook events:

- `SessionStart`
- `UserPromptSubmit`
- `Stop`

Always run readiness checks through:

```bash
node .agents/skills/epic-loop/scripts/doctor.mjs --json
```

Only bound sessions may write epic-loop runtime state. Unbound sessions must produce no epic-loop records.

## Implementation Loop Rules

Implementation starts only after explicit user confirmation in the current session.

Binding command:

```bash
node .agents/skills/epic-loop/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

After binding, stop the current user turn. The `Stop` hook should continue with the first techlead turn.

Techlead owns:

- closure decisions
- active task and active phase transitions
- tracker state
- implementation log entries
- decision and risk updates
- commit decisions
- next engineer brief
- pause, reset, review, or idle decisions

Engineer owns:

- executing one concrete brief
- making code changes if needed
- running relevant verification
- reporting changed files, behavior, verification, blockers, and follow-ups
- stopping after the final report

Engineer must not receive routing instructions, tracker closure instructions, implementation-log instructions, hook commands, or role mechanics.

## Required Script-Driven Operations

Use scripts for mechanical state changes:

```bash
node .agents/skills/epic-loop/scripts/start-task.mjs --slug "<slug>" --task-id "<task-id>"
node .agents/skills/epic-loop/scripts/close-task.mjs --slug "<slug>" --task-id "<task-id>"
node .agents/skills/epic-loop/scripts/set-task-status.mjs --slug "<slug>" --task-id "<task-id>" --status "<status>"
node .agents/skills/epic-loop/scripts/start-phase.mjs --slug "<slug>" --phase-id "<phase-id>"
node .agents/skills/epic-loop/scripts/close-phase.mjs --slug "<slug>" --phase-id "<phase-id>"
node .agents/skills/epic-loop/scripts/append-implementation-log.mjs --slug "<slug>" --task "<task>" --verdict "<verdict>"
node .agents/skills/epic-loop/scripts/write-engineer-brief.mjs --slug "<slug>" --stdin
node .agents/skills/epic-loop/scripts/role-summary.mjs --slug "<slug>"
```

Avoid hand-editing `tracker.md`, `runtime-state.json`, or large implementation logs for mechanical transitions.

## Fixture App Rules

Use the app only as test material.

Valid reasons to edit the fixture app:

- testing whether engineer prompts stay narrow
- testing task closure and verification behavior
- generating realistic diffs for techlead review
- testing context pressure in implementation loops
- testing failure recovery, blockers, and interrupted turns

Invalid reasons:

- improving the app for its own sake
- refactoring unrelated app code
- polishing UI unrelated to a skill test
- treating app backlog as project priority

Treat every fixture change as a test scenario, not as roadmap progress for the app itself.

## Verification

For skill script changes:

```bash
for f in .agents/skills/epic-loop/scripts/*.mjs .agents/skills/epic-loop/scripts/lib/*.mjs; do node --check "$f" || exit 1; done
```

For hook readiness:

```bash
node .agents/skills/epic-loop/scripts/doctor.mjs --json
```

For fixture app verification, use only when relevant:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm build
```

## Context Hygiene

Context pressure is part of the product problem.

Do not read large runtime logs in normal flow:

- prompt logs
- progress logs
- hook event dumps
- session debug traces
- full transcript files

Use compact scripts and targeted reads instead.

Do not search `.next`, runtime logs, or generated output unless the task specifically requires it.

Prefer reading exact files and small sections over broad recursive searches.

When a change makes the framework more dependent on reading large artifacts, treat that as a design smell unless there is a very strong reason.

## Communication With Oleg

When discussing this repository, keep the focus on skill behavior, DX, hook mechanics, state design, orchestration quality, and test evidence.

If the fixture app creates noise, say that it is fixture noise and separate it from skill findings.

When something breaks, identify whether the failure is in:

- skill instructions
- hook setup
- runtime/session routing
- state model
- techlead prompt
- engineer brief
- fixture app implementation
- Codex platform behavior

Do not hide uncertainty. This repository is for discovering those boundaries clearly.

When discussing options, keep the conversation anchored in:

- how the skill should behave in the long run
- whether a decision improves or harms role clarity
- whether a decision reduces or increases context pressure
- whether a decision belongs in prompting logic or technical infrastructure
