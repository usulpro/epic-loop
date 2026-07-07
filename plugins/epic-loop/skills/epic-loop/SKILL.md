---
name: epic-loop
description: Use this skill when the user explicitly asks to run the epic-loop runtime or work inside an epic-loop workspace: reading or editing `.epic-loop/` artifacts; adding, editing, or closing epic tasks, research tasks, or phases; switching shaping, implementation, or review modes; resuming an epic by slug; detaching the current session when the user says `unbind epic` or asks to work outside the epic; or when hook context includes `[epic-loop] epic=... mode=...`.
---

# Epic Loop

## Purpose

`epic-loop` turns a large feature or migration into a durable program of work. The epic has its own workspace, artifacts, lifecycle modes, and re-entry path so the agent can preserve intent, decisions, roadmap, risks, and implementation state across sessions.

When commands use `<skill-dir>`, replace it with the absolute directory that contains this `SKILL.md`.

## First Move

Before asking for the epic title or lifecycle mode, run `doctor` with an explicit runtime platform. `--platform` is mandatory on every doctor run:

```bash
node <skill-dir>/scripts/doctor.mjs --platform codex --json
node <skill-dir>/scripts/doctor.mjs --platform claude-code --json
```

The selected platform is stored in project-local runtime config under `.epic-loop/.runtime/platform.json` for other platform-aware scripts. Do not infer the platform from payload shape, cwd, environment variables, `.codex/`, `.claude/`, transcript paths, or an existing `platform.json`. Switching platforms in the same checkout requires running `doctor.mjs --platform <platform> --json` again and reinstalling hooks for that platform.

Never run `doctor.mjs --json` without `--platform`; missing `--platform` is a hard error.

If the result is `ready`, continue to local epic discovery.

If the current runtime is unclear, ask which runtime to use, then rerun `doctor` with `--platform codex` or `--platform claude-code`.

If the result is `setup-required`, do not ask the shaping/resume question yet. Use a very short setup exchange and do not mention internal diagnostics unless the user asks.

- **Automatic setup**: if the selected platform's project-local hook config is writable and the user explicitly approves setup, run `node <skill-dir>/scripts/install-hooks.mjs`.
- **Manual setup**: if the selected platform's project-local hook config is not writable from the current session, give the exact command for the user to run from a writable project checkout or host terminal.

For Codex, setup writes `.codex/hooks.json` and `doctor` also checks the active Codex hooks feature flag. Do not edit global Codex config from this skill. If `doctor` reports that Codex hooks are missing or disabled, explain where the active hooks feature flag appears to be missing and ask the user before changing any project-local config.

For Claude Code, setup writes project-local `.claude/settings.json`. Do not edit global Claude settings from this skill. `doctor` also checks `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`; missing, invalid, or too-low values are setup-required.

Keep the user-facing setup message ultra-short. Do not paste the full doctor output unless the user asks for details. Do not mention `ready: true`, config paths, global config, event lists, or other diagnostics in the normal flow.

Use this shape when setup is possible but not yet approved:

```text
epic-loop needs to add project-local hooks for <platform>. Install them now?
```

Use this shape when the current session cannot write the selected platform's project-local hook config:

```text
Hooks need setup, but this session cannot write the project-local hook config.

cd <project-root>
node <skill-dir>/scripts/install-hooks.mjs
```

Use this shape when the user asked to install and the automatic install failed:

```text
I tried to install hooks, but the project-local hook config is not writable here.

cd <project-root>
node <skill-dir>/scripts/install-hooks.mjs
```

Use this shape after successful automatic setup:

```text
Hooks are configured. We can start the epic.
```

Use dry-run when the user wants to inspect the planned hook changes first:

```bash
node <skill-dir>/scripts/install-hooks.mjs --dry-run
```

After hooks are ready, list local epics before asking for any mode:

```bash
node <skill-dir>/scripts/list-epics.mjs --json
```

If local epics exist, show a compact list with each epic's title, slug, and how long ago it was updated. Then ask only:

```text
Which epic should we continue?
```

Do not show the lifecycle mode menu in this first response. If the user wants a new epic instead of an existing one, they will describe it.

If no local epics exist and the user has not described the desired epic yet, say:

```text
There are no local epics yet. Let's discuss which epic to create.
```

Do not ask the user for a title or slug for a new epic. When the user describes the desired epic, generate the title and slug from that description and initialize the workspace:

```bash
node <skill-dir>/scripts/init-epic.mjs --description "<user epic description>"
```

Epic slugs must be compact: at most two slug words joined with `-`, and at most 30 characters total. Always derive the slug from an English basis: if the user's description is not in English, first choose a short English phrase that captures the epic intent, then slugify that English phrase.

After creating an epic, report it plainly:

```text
Epic created.

Folder: .epic-loop/epics/<slug>
Slug: <slug>

Use this slug to continue the epic in a new session.
```

Do not describe generated slugs as normal, normalized, fixed, renamed, corrected, or similar.

Only after local epic context is clear, decide the mode before doing epic work:

- **Shaping**: the user is still clarifying the epic, roadmap, phases, contracts, risks, or open questions. When the active architecture, roadmap, or assumptions stop being reliable, run the reset escalation ladder from inside shaping (see Shaping Rules) instead of switching to a separate mode.
- **Implementation**: the epic has actionable tasks and the user wants autonomous execution.
- **Review**: a completed slice must be checked against the original conversation intent, not only current docs.
- **Resume**: the user gives an existing epic slug or asks to continue previous epic work.

For explicit lifecycle transitions outside the implementation-start binding flow, update the epic runtime mode with:

```bash
node <skill-dir>/scripts/set-epic-mode.mjs --slug "<epic-slug>" --mode shaping|implementation|review
```

Use it when reopening shaping or entering review. Do not hand-edit `state-of-epic.md` to change lifecycle mode.

If no epic workspace exists, initialize one with:

```bash
node <skill-dir>/scripts/init-epic.mjs --description "Epic description"
```

If the user provides a slug, resume from `.epic-loop/epics/{epic-slug}` in the current project unless they specify another root. During resume/orientation, auto-bind the current session as an epic member when a fresh `UserPromptSubmit` hook capture is available:

```bash
node <skill-dir>/scripts/auto-bind-session.mjs --current --slug "<epic-slug>"
```

For a path-based resume, pass the epic folder path instead:

```bash
node <skill-dir>/scripts/auto-bind-session.mjs --current --path ".epic-loop/epics/<epic-slug>"
```

If auto-bind prints that it skipped because no fresh `UserPromptSubmit` capture was available, continue orientation and mention in one line that this session was not auto-bound, so the compact marker may not appear on the next turn. Auto-bind only creates mode-less membership; it must not designate an implementation driver or start the implementation loop.

When the user invokes the skill with only an epic slug, treat it as resume/orientation, not permission to execute implementation. Read the re-entry artifacts, report the current state, and stop with a short readiness prompt. If the epic is ready for implementation, use this shape:

```text
Epic loaded.

Folder: .epic-loop/epics/<slug>
Slug: <slug>
State: ready for implementation.

Start implementation in this session?
```

Start implementation only after explicit confirmation from the user in the current session. When the user confirms, activate this session for hook routing:

```bash
node <skill-dir>/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

If `--current` cannot detect the session, ask for the session id instead of guessing.

After binding, do not start code implementation manually in the same user turn. Report that the implementation loop is active and stop. A loaded and trusted `Stop` hook on the selected platform continues the same session with the first `manager` housekeeping turn by returning `{ "decision": "block", "reason": "<prompt>" }`.

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

Epic-loop stores human-facing epic artifacts under `.epic-loop/epics/{epic-slug}` and machine/runtime artifacts under hidden `.runtime` folders.

Each epic should expose these human-facing files:

- `state-of-epic.md`: current mode, phase, last known state, blockers, next move.
- `tracker.md`: rendered phases, tasks, task kinds, status, acceptance criteria, doc links.
- `implementation-log.md`: append-only execution notes, verification results, commits, blockers.
- `decision-log.md`: architectural decisions, tradeoffs, rejected options, unresolved design questions.
- `risk-register.md`: risks, deferred concerns, mitigation ideas, owner/status when known.
- `docs/problem-framing.md`: initial problem framing and scope source of truth.
- `docs/`: additional documentation pack for architecture, contracts, verification, and rollout.

Each epic stores hidden machine artifacts under `.epic-loop/epics/{epic-slug}/.runtime/`:

- `runtime-state.json`: lightweight machine-readable coordination state.
- `roadmap-state.json`: best-effort structured bookkeeping for scripts. It is not allowed to override the human-visible tracker during implementation.
- `current-engineer-prompt.md`: replaceable active engineer brief.
- `prompt-log.md` and `prompt-log.jsonl`: append-only implementation prompt log.
- `progress-log.md`, `progress-log.jsonl`, and `progress-report.md`: lifecycle timing and role progress traces.
- `engineer-reports.md`, `engineer-reports.jsonl`, and `latest-engineer-report.md`: final engineer messages captured from `Stop` hooks.
- `manager-reports.md`, `manager-reports.jsonl`, and `latest-manager-report.md`: final manager housekeeping messages captured from `Stop` hooks.

Global routing/session runtime lives under `.epic-loop/.runtime/`.

Read [references/artifact-model.md](references/artifact-model.md) when creating or repairing an epic workspace.

## Mode References

Load the detailed reference for the active mode:

- Shaping: [references/shaping-mode.md](references/shaping-mode.md)
- Implementation cycle: [references/implementation-cycle.md](references/implementation-cycle.md)
- Implementation manager role: [references/implementation-manager-role.md](references/implementation-manager-role.md)
- Implementation techlead role: [references/implementation-techlead-role.md](references/implementation-techlead-role.md)
- Implementation engineer role: [references/implementation-engineer-role.md](references/implementation-engineer-role.md)
- Review: [references/review-mode.md](references/review-mode.md)
- Architecture reset (procedure run inside shaping, not a standalone mode): [references/reset-protocol.md](references/reset-protocol.md)
- Parallel sessions: [references/parallel-sessions.md](references/parallel-sessions.md)
- Hooks and session routing: [references/hooks-and-session-routing.md](references/hooks-and-session-routing.md)

Keep `SKILL.md` as the operating map. Use references only when the mode or problem requires the details.

## Shaping Rules

Shaping is a rhythmic dialogue, not one large planning dump. Work topic by topic, capture decisions and open questions, then grow the docs and tracker as clarity appears. A plain imperative from the user ("do X", "research Y") means capture it as a task in `tracker.md`, not execute it now; say so in one line, e.g. "Adding a follow-up task for X."

The agent owns decomposition. The user can name big phases or areas, but should not have to produce the roadmap. Tasks should stay goal-oriented until implementation mode needs task-local detail.

When writing implementation tasks, always include:

- expected system outcome
- implementation surface
- acceptance criteria based on behavior, contract, or verification
- relevant docs

Design-like titles and `Docs:` links are not enough. If a task sounds like documentation-only but should change code or runtime behavior, rewrite it before execution.

When a task needs more detail than fits cleanly in `tracker.md`, move that detail into referenced docs instead of bloating the task text. Prefer separate doc files for separate tasks. Use shared docs only when two or three closely related tasks truly share the same narrow scope, governing principles, or a paired relationship such as implementation plus validation. A task may reference multiple docs when that reduces duplication, for example one shared principles doc plus one task-specific spec. The governing rule is to keep each task's read scope as small and relevant as possible.

Verification tasks are stricter than normal implementation tasks. A `verification` task must name the concrete verification method, tools, setup, evidence, and cleanup path, not only the thing being verified. Each phase must contain at least one `verification` task. By default, the final task of the phase should verify the combined result of that phase. Add extra intermediate verification tasks after risky tasks when phase-level verification alone would be too weak.

When the active architecture, roadmap, or task framing is no longer a reliable guide, do not keep patching locally. Follow the reset escalation ladder in [references/reset-protocol.md](references/reset-protocol.md) — local correction, tactical detour, or strategic reset — from inside the shaping session, then resume shaping or implementation with the corrected source of truth. Reset is not a separate mode.

## Implementation Rules

Implementation uses a governed `manager -> techlead -> engineer` loop with explicit housekeeping passes.

Do not enter implementation automatically from a slug-only resume. First report that the epic is ready, then wait for explicit confirmation to run implementation in the current session.

When implementation starts, the first hook-driven continuation must be `manager` in housekeeping mode. The manager performs implementation-entry housekeeping and then returns control only to `techlead`.

Inside implementation mode, role transfer rules are strict:

- `manager` only performs housekeeping and always hands control back to `techlead`
- `techlead` may hand control to `engineer`, hand control to `manager` for housekeeping, or stop the loop
- `engineer` never chooses routing; the hook returns control automatically

Every implementation continuation must be recorded inside the epic runtime. Prompt text goes to `.runtime/prompt-log.md` and `.runtime/prompt-log.jsonl`. Lifecycle events and timing go to `.runtime/progress-log.jsonl` and readable `.runtime/progress-log.md`, with `.runtime/progress-report.md` regenerated from the structured event log.

Engineer turns are skill-agnostic. The engineer receives only a normal task brief, never loop routing instructions. When an engineer turn stops, the `Stop` hook captures the final assistant message into `.runtime/latest-engineer-report.md` and returns control to `techlead`. Codex report capture uses `last_assistant_message`; Claude Code report capture reads the latest assistant text from `transcript_path` JSONL.

Manager turns are also role-specific and non-product. They perform housekeeping only. When a manager turn stops, the `Stop` hook captures the final assistant message into `.runtime/latest-manager-report.md` and returns control to `techlead`.

If a bound implementation session receives a new `UserPromptSubmit` while a turn is still open, treat the open turn as interrupted. Record `turn-interrupted`, set the loop status to `interrupted`, and do not auto-continue until a new implementation start/resume explicitly rebinds or restarts the loop. If implementation is restarted while an older open turn exists, close the old turn as interrupted without inventing active duration.

`techlead` owns tactical orchestration:

- verify whether the previous task is truly closed
- choose the next actionable task from the human-visible `tracker.md` order
- understand intent, constraints, docs, code context, and verification scope
- produce a short execution brief
- escalate blockers, architecture drift, or unclear tasks
- create or require a concrete phase-level `verification` task before closing a phase if one is missing
- enforce task commit discipline: every honestly closed task must have a meaningful task commit, while epic artifact cleanup belongs in that task commit rather than a separate housekeeping commit
- explicitly trigger manager housekeeping before implementation start, after honest phase completion, and before final implementation exit

Use `node <skill-dir>/scripts/role-summary.mjs --slug "<epic-slug>"` for compact loop state plus latest manager and engineer reports. Do not read prompt/progress runtime logs during normal implementation flow.

Implementation must keep moving when the next task is clear. `tracker.md` is the task-order source of truth for techlead decisions. Structured roadmap scripts are convenience bookkeeping only. If a script task id, active task, or rendered tracker state disagrees with the visible `tracker.md`, do not stop the implementation loop solely for that mismatch. Record the mismatch in `implementation-log.md` or `state-of-epic.md`, update the human-facing files directly if needed, and continue with the next visible actionable task. Use `idle` only for a real product, design, verification, dependency, or user-decision blocker.

If implementation should continue, `techlead` writes a concrete engineer brief through the brief writer and then sets the next role:

```bash
node <skill-dir>/scripts/write-engineer-brief.mjs --slug "<epic-slug>" --stdin
node <skill-dir>/scripts/set-next-role.mjs --slug "<epic-slug>" --role engineer --prompt-file ".epic-loop/epics/<epic-slug>/.runtime/current-engineer-prompt.md" --reason "<short reason>"
```

If `techlead` needs housekeeping, it must explicitly hand off to manager and stop:

```bash
node <skill-dir>/scripts/set-next-role.mjs --slug "<epic-slug>" --role manager --reason "<housekeeping reason>"
```

Housekeeping reasons should be explicit, for example:

- `implementation-start-housekeeping`
- `phase-closure-housekeeping`
- `implementation-end-housekeeping`
- `artifact-compaction-housekeeping`

If implementation should pause or stop after any required housekeeping has completed, `techlead` runs:

```bash
node <skill-dir>/scripts/set-next-role.mjs --slug "<epic-slug>" --role idle --reason "<why the loop stops>"
```

`engineer` owns tactical execution:

- receives a normal task brief only
- implements the requested slice
- verifies the change at the right level
- reports changed files, verification, blockers, gaps, or follow-up notes
- stops after the final report; the hook returns control to `techlead`

Use `write-engineer-brief.mjs` for engineer handoffs. Do not keep handoff prompts in the human-facing epic root.

Only `manager` may compact human-facing epic artifacts. Do not compact `docs/` documents. Compact only key non-doc artifacts whose inactive historical layer is no longer part of the current execution path, such as completed phase sections in `tracker.md` or historical closed-task layers in logs and registers.

## Review Rules

Review mode checks whether the implementation matches the original intent, not just whether it matches the latest docs. It should compare:

- original user goals and priorities
- what was captured in docs and tracker
- what was actually implemented
- what may have drifted, been lost, or been over-literalized

Review findings should become docs corrections, follow-up tasks, a new implementation slice, or a return to shaping. Review can also resolve into a small immediate fix; state in one line which path is being taken (e.g. "Adding a follow-up task" vs "Applying this fix directly") so the user can correct a misread immediately.

## Parallel Work

One session may be in only one mode at a time. An epic has one shared runtime mode, so same-epic different-mode sessions are not supported; multiple sessions on the same epic share that mode, and in implementation mode only the driver edits implementation artifacts. Avoid conflicting writes by treating artifacts as mode-owned when possible:

- Shaping owns future docs, roadmap changes, open questions, and reset/baseline transitions when the reset ladder is invoked.
- Implementation owns active task status, implementation log, verification notes, and task-local briefs.
- Review owns review findings, drift analysis, and proposed follow-ups.

When parallel work may collide, read current files immediately before editing and append dated entries instead of rewriting broad sections.

## Hooks

Use project-local hooks for epic-loop work. Select the runtime platform first, then install hooks from the project root with:

```bash
node <skill-dir>/scripts/doctor.mjs --platform codex --json
# or:
node <skill-dir>/scripts/doctor.mjs --platform claude-code --json

node <skill-dir>/scripts/install-hooks.mjs
```

For Codex, the installer writes project-local `.codex/hooks.json`. For Claude Code, it writes project-local `.claude/settings.json`. In both cases the local config should route `SessionStart`, `UserPromptSubmit`, and `Stop` events to the epic-loop hook handler. The installer must preserve unrelated hooks/settings, add missing epic-loop event entries, and update stale epic-loop hook commands when the skill path changed.

The hook handler is strict opt-in: it writes state only when `session_id` is already registered in `.epic-loop/.runtime/session-bindings.json`. Unbound sessions must be a silent no-op. Keep `.codex/hooks.json` and `.claude/settings.json` as static config; all mutable epic-loop state belongs in `.epic-loop/`.

On `UserPromptSubmit`, a bound member session may receive a compact marker like `[epic-loop] epic=<slug> mode=<mode> — follow epic-loop skill mode rules`; apply the mode rules from this skill for that epic. If the marker says `mode=implementation — loop running in another session; read-only, do not edit epic artifacts`, treat this session as a non-driver observer: do not edit epic artifacts or implementation state from that session.

Codex requires non-managed command hooks to be reviewed and trusted before they run. Claude Code also requires hook review/trust through `/hooks`. A static `doctor` result can prove that project-local hook config exists and platform prerequisites are satisfied, but it cannot prove that the current already-running thread has loaded and trusted the hook. If implementation does not continue after binding, inspect `/hooks` in the active platform UI/CLI and start or resume a trusted session.

Bind the current session to an epic explicitly when running parallel sessions:

```bash
node <skill-dir>/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

For resume/orientation membership, use `auto-bind-session.mjs --current --slug "<epic-slug>"` or `--path "<epic-path>"`; it accepts only a fresh `UserPromptSubmit` hook capture and skips harmlessly otherwise. For implementation driver binding, `bind-session.mjs --current` uses the existing Codex hook capture/session fallback; Claude Code requires a fresh hook capture with `session_id` and `transcript_path`. If implementation driver binding cannot detect the current session safely, pass `--session-id "<session_id>"` explicitly.

Many sessions may be active members of the same epic and share the epic runtime mode. Implementation still has one exclusive driver recorded in the epic runtime state.

Unbind the current session when the user wants it to stop working through the epic. The canonical trigger phrase is `unbind epic`, but do not require it verbatim: when the user expresses intent to work outside the epic in this session (for example "do this right now, without the epic" or "let's work outside the epic for a bit"), call the unbind script proactively and confirm in one line that the session was unbound:

```bash
node <skill-dir>/scripts/unbind-session.mjs --current
# or, when the current session cannot be detected safely:
node <skill-dir>/scripts/unbind-session.mjs --session-id "<session_id>"
```

An optional `--reason "<short reason>"` records why the session detached. The script has no `--slug`/`--mode` flags: it deactivates whatever epic/mode the resolved session is actively bound to, and it is a harmless no-op when the session is not bound. Epic-loop hooks become silent no-ops for that session id afterwards. To work on the epic again later, use the normal resume flow and `bind-session.mjs`; there is no separate reattach mechanism.

Do not block epic work solely because hook automation is absent.
