---
name: epic-loop
description: Use this skill when the user wants to shape, run, resume, reset, or review a long-lived epic-level software effort across multiple sessions. It is for sustained autonomous engineering work with an epic workspace, tracker, documentation pack, decision log, risk register, lifecycle modes, and a techlead/engineer implementation cycle. Do not use it for one-off feature requests, simple checklist execution, or generating a large document in a single pass.
---

# Epic Loop

## Purpose

`epic-loop` turns a large feature or migration into a durable program of work. The epic has its own workspace, artifacts, lifecycle modes, and re-entry path so the agent can preserve intent, decisions, roadmap, risks, and implementation state across sessions.

## First Move

Before asking for the epic title or lifecycle mode, run the technical readiness check:

```bash
node .agents/skills/epic-loop/scripts/doctor.mjs --json
```

If the result is `ready`, continue to local epic discovery.

If the result is `setup-required`, do not ask the shaping/resume question yet. Use a very short setup exchange and do not mention internal diagnostics unless the user asks.

- **Automatic setup**: if `.codex/hooks.json` is writable and the user explicitly approves setup, run `node .agents/skills/epic-loop/scripts/install-hooks.mjs`.
- **Manual setup**: if `.codex/hooks.json` is not writable from the current session, give the exact command for the user to run from a writable project checkout or host terminal.

Do not edit global Codex config from this skill. If `doctor` reports that `codex_hooks` is missing or disabled, explain where it appears to be missing and ask the user before changing any project-local config.

Keep the user-facing setup message ultra-short. Do not paste the full doctor output unless the user asks for details. Do not mention `ready: true`, config paths, global config, event lists, or other diagnostics in the normal flow.

Use this shape when setup is possible but not yet approved:

```text
проверила: epic-loop needs to add project-local Codex hooks. Install them now?
```

Use this shape when the current session cannot write `.codex/hooks.json`:

```text
проверила: hooks need setup, but this session cannot write `.codex/hooks.json`.

cd <project-root>
node .agents/skills/epic-loop/scripts/install-hooks.mjs
```

Use this shape when the user asked to install and the automatic install failed:

```text
попробовала установить hooks, но `.codex/hooks.json` is not writable here.

cd <project-root>
node .agents/skills/epic-loop/scripts/install-hooks.mjs
```

Use this shape after successful automatic setup:

```text
готово, hooks настроены. можем начинать epic.
```

Use dry-run when the user wants to inspect the planned hook changes first:

```bash
node .agents/skills/epic-loop/scripts/install-hooks.mjs --dry-run
```

After hooks are ready, list local epics before asking for any mode:

```bash
node .agents/skills/epic-loop/scripts/list-epics.mjs --json
```

If local epics exist, show a compact list with each epic's title, slug, and how long ago it was updated. Then ask only:

```text
какой epic продолжаем?
```

Do not show the lifecycle mode menu in this first response. If the user wants a new epic instead of an existing one, they will describe it.

If no local epics exist and the user has not described the desired epic yet, say:

```text
локальных epic пока нет. давай обсудим, какой epic создаём.
```

Do not ask the user for a title or slug for a new epic. When the user describes the desired epic, generate the title and slug from that description and initialize the workspace:

```bash
node .agents/skills/epic-loop/scripts/init-epic.mjs --description "<user epic description>"
```

Epic slugs must be compact: at most two slug words joined with `-`, and at most 30 characters total.

After creating an epic, report it plainly:

```text
Эпик создан.

Папка: .epic-loop/epics/<slug>
Slug: <slug>

Используй этот slug, чтобы продолжить epic в новой сессии.
```

Do not describe generated slugs as normal, normalized, fixed, renamed, corrected, or similar.

Only after local epic context is clear, decide the mode before doing epic work:

- **Shaping**: the user is still clarifying the epic, roadmap, phases, contracts, risks, or open questions.
- **Implementation**: the epic has actionable tasks and the user wants autonomous execution.
- **Review**: a completed slice must be checked against the original conversation intent, not only current docs.
- **Reset**: the architecture, roadmap, or assumptions are no longer valid and need a controlled rewrite.
- **Resume**: the user gives an existing epic slug or asks to continue previous epic work.

If no epic workspace exists, initialize one with:

```bash
node .agents/skills/epic-loop/scripts/init-epic.mjs --description "Epic description"
```

If the user provides a slug, resume from `.epic-loop/epics/{epic-slug}` in the current project unless they specify another root.

When the user invokes the skill with only an epic slug, treat it as resume/orientation, not permission to execute implementation. Read the re-entry artifacts, report the current state, and stop with a short readiness prompt. If the epic is ready for implementation, use this shape:

```text
Эпик прочитан.

Папка: .epic-loop/epics/<slug>
Slug: <slug>
Состояние: готов к implementation.

Запускаю implementation в этой session?
```

Start implementation only after explicit confirmation from the user in the current session. When the user confirms, activate this session for hook routing:

```bash
node .agents/skills/epic-loop/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

If `--current` cannot detect the session, ask for the session id instead of guessing.

## Re-Entry Checklist

At the start of every non-trivial turn, read only the artifacts needed for the selected mode, but always orient from:

1. Project instructions such as `AGENTS.md`, local docs, and relevant repo conventions.
2. `.epic-loop/epics/{slug}/state-of-epic.md`
3. `.epic-loop/epics/{slug}/tracker.md`
4. `.epic-loop/epics/{slug}/implementation-log.md`
5. `.epic-loop/epics/{slug}/decision-log.md`
6. `.epic-loop/epics/{slug}/risk-register.md`

Do not depend on chat memory as the only source of truth. If the current conversation contains new intent, capture it into the epic artifacts before it is lost.

## Artifact Model

Epic-loop stores all mutable project-local state under `.epic-loop/`. Epic workspaces live under `.epic-loop/epics/{epic-slug}`. Each epic should contain:

- `state-of-epic.md`: current mode, phase, last known state, blockers, next move.
- `tracker.md`: phases, tasks, task kinds, status, acceptance criteria, doc links.
- `implementation-log.md`: execution notes, verification results, commits, blockers.
- `decision-log.md`: architectural decisions, tradeoffs, rejected options, unresolved design questions.
- `risk-register.md`: risks, deferred concerns, mitigation ideas, owner/status when known.
- `docs/problem-framing.md`: initial problem framing and scope source of truth.
- `docs/`: additional documentation pack for architecture, contracts, verification, and rollout.
- `runtime-state.json`: lightweight machine-readable coordination state.
- Optional `execution-brief.md` or `prompt.md` for handoff-heavy tasks.

Read [references/artifact-model.md](references/artifact-model.md) when creating or repairing an epic workspace.

## Mode References

Load the detailed reference for the active mode:

- Shaping: [references/shaping-mode.md](references/shaping-mode.md)
- Implementation: [references/implementation-cycle.md](references/implementation-cycle.md)
- Review: [references/review-mode.md](references/review-mode.md)
- Architecture reset: [references/reset-protocol.md](references/reset-protocol.md)
- Parallel sessions: [references/parallel-sessions.md](references/parallel-sessions.md)
- Hooks and session routing: [references/hooks-and-session-routing.md](references/hooks-and-session-routing.md)

Keep `SKILL.md` as the operating map. Use references only when the mode or problem requires the details.

## Shaping Rules

Shaping is a rhythmic dialogue, not one large planning dump. Work topic by topic, capture decisions and open questions, then grow the docs and tracker as clarity appears.

The agent owns decomposition. The user can name big phases or areas, but should not have to produce the roadmap. Tasks should stay goal-oriented until implementation mode needs task-local detail.

When writing implementation tasks, always include:

- expected system outcome
- implementation surface
- acceptance criteria based on behavior, contract, or verification
- relevant docs

Design-like titles and `Docs:` links are not enough. If a task sounds like documentation-only but should change code or runtime behavior, rewrite it before execution.

## Implementation Rules

Implementation uses a turn-by-turn `techlead -> engineer -> techlead` cycle.

Do not enter implementation automatically from a slug-only resume. First report that the epic is ready, then wait for explicit confirmation to run implementation in the current session.

`techlead` owns tactical orchestration:

- verify whether the previous task is truly closed
- choose the next actionable task
- understand intent, constraints, docs, code context, and verification scope
- produce a short execution brief
- escalate blockers, architecture drift, or unclear tasks

`engineer` owns tactical execution:

- implement the brief
- verify the change at the right level
- update task-related artifacts
- return blockers or mismatches to `techlead`

`execution-brief.md` or `prompt.md` is optional. Create it when the task is long, handoff-heavy, hook-driven, or likely to span turns.

## Review Rules

Review mode checks whether the implementation matches the original intent, not just whether it matches the latest docs. It should compare:

- original user goals and priorities
- what was captured in docs and tracker
- what was actually implemented
- what may have drifted, been lost, or been over-literalized

Review findings should become docs corrections, follow-up tasks, a new implementation slice, or a return to shaping.

## Reset Rules

Use reset mode when the active architecture, roadmap, or assumptions are no longer reliable. Do not silently keep executing a stale tracker.

A reset should:

1. Stop linear execution.
2. Record why the reset is needed.
3. Mark old roadmap/docs as historical baseline where appropriate.
4. Define the new active plan.
5. Update tracker, state, decision log, and risk register.
6. Resume in shaping or implementation with the new source of truth.

## Parallel Work

One session may be in only one mode at a time, but multiple sessions may work on the same epic in different modes. Avoid conflicting writes by treating artifacts as mode-owned when possible:

- Shaping owns future docs, roadmap changes, and open questions.
- Implementation owns active task status, implementation log, verification notes, and task-local briefs.
- Review owns review findings, drift analysis, and proposed follow-ups.
- Reset owns baseline transition notes and active plan replacement.

When parallel work may collide, read current files immediately before editing and append dated entries instead of rewriting broad sections.

## Hooks

Use project-local hooks for epic-loop work. Install them from the project root with:

```bash
node .agents/skills/epic-loop/scripts/install-hooks.mjs
```

The local `.codex/hooks.json` should route `SessionStart`, `UserPromptSubmit`, and `Stop` events to the epic-loop hook handler. The installer must preserve unrelated hooks, add missing epic-loop event entries, and update stale epic-loop hook commands when the skill path changed.

The hook handler is strict opt-in: it writes state only when `session_id` is already registered in `.epic-loop/session-bindings.json`. Unbound sessions must be a silent no-op. Keep `.codex/hooks.json` as static config; all mutable epic-loop state belongs in `.epic-loop/` because `.codex/` may be read-only in sandboxed sessions.

Bind a Codex session to an epic explicitly when running parallel sessions:

```bash
node .agents/skills/epic-loop/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

There is one active hook-routed session per epic/mode. Binding the current session for the same epic and mode deactivates the previous active session.

Do not block epic work solely because hook automation is absent.
