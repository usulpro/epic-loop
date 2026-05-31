# epic-loop

> A Codex / Claude Code skill for running long autonomous coding sessions without losing the plot.

epic-loop splits a single agent session into two roles — **techlead** and **engineer** — that hand off through the **Stop hook**. The techlead plans, the engineer executes, the loop runs until the work is actually done. Epic state lives on disk, so sessions can be resumed by anyone, at any time.

It runs on **Codex** or **Claude Code**: both expose the same Stop-hook continuation contract, so the same skill drives the loop on either platform (one platform per session). The scripts auto-detect the platform and also accept an explicit `--platform codex|claude`.

---

## The problem

Long autonomous coding sessions waste hours on human glue:

- Manually prompting the agent for the next step
- Reviewing output before deciding what comes next
- Picking and scoping the next task
- Writing a precise prompt to get the model to do it well
- Repeat

These are repeatable patterns. They don't need a human in the loop — they need the right orchestration.

Hooks make the orchestration possible — particularly the **Stop hook**, which can return a continuation prompt to the same session. Codex and Claude Code both expose this contract (`{ "decision": "block", "reason": "<next prompt>" }`), so epic-loop is the skill that makes it usable on either one.

---

## How it works

A single agent session (Codex or Claude Code) alternates between two roles, driven by the Stop hook:

```
single agent session:

  techlead  ──writes prompt for──▶  engineer
      ▲                                 │
      └────────── Stop hook ────────────┘
```

**techlead role.** Gets a standard prompt every turn: read epic state, do the formal work (task tracking, git commits, review, doc analysis), decide what comes next, and write a precise custom prompt for the engineer's next turn. Hands off via the Stop hook.

**engineer role.** Gets a focused, custom prompt for one task. Executes it. Hands back to techlead.

**Single session.** Both roles run in the same agent session — no second process, no inter-process plumbing. The Stop hook is what makes the alternation possible.

**Durable epic state.** Each epic lives at `.epic-loop/epics/<slug>/` with its own docs, tracker, decisions, and progress logs. Sessions die, contexts compact, machines crash — the epic survives. Any developer can resume any epic in any session.

---

## Modes

- **Implementation** — the techlead/engineer loop described above
- **Planning** — shaping new epics: creating docs, decomposing tasks
- **Review** — verifying completed work

Modes are explicit. The skill knows which mode it's in and adapts behavior accordingly.

---

## Why this design

**Engineer focuses on one task at a time.** Engineer turns are scoped and clean. The engineer doesn't know about the loop, the tracker, or epic-loop internals — it just executes the prompt it received.

**The loop won't stop until the work is done.** A stop criterion is set up front. Until it fires, the Stop hook keeps the session going.

**Survives context compaction.** Long task lists run cleanly through compaction because each engineer turn gets a freshly composed, scoped prompt — not accumulated session history.

**Resumable.** Epics commit to git. Documentation, prompts, and progress are part of the repo. A new developer can pick up an in-flight epic in a new session without context loss.

**Flexible.** Any process you can describe as a sequence of tracked tasks can run through epic-loop. Long task lists work especially well.

---

## Requirements

- **Codex** (with `hooks = true` enabled) **or Claude Code** — either provides the Stop hook
- Node.js (skill scripts are `.mjs`)
- A project where you want to run long autonomous coding sessions

---

## Installation

epic-loop is a project-local skill. Drop the skill into `.agents/skills/epic-loop/` in your project. For Claude Code discoverability it is also exposed at `.claude/skills/epic-loop` (a symlink to the same source). Then set up the project-local hooks:

```bash
# Check technical readiness (auto-detects Codex vs Claude Code)
node .agents/skills/epic-loop/scripts/doctor.mjs

# Install project-local hooks
#   Codex      -> .codex/hooks.json
#   Claude Code -> .claude/settings.json
# Add --platform codex|claude to override auto-detection.
node .agents/skills/epic-loop/scripts/install-hooks.mjs

# Bind the current session to an epic
node .agents/skills/epic-loop/scripts/bind-session.mjs \
  --current --slug "<epic-slug>" --mode implementation
```

Unbound sessions are silent no-ops — epic-loop only activates for sessions explicitly bound to an epic.

---

## Epic structure

Each epic at `.epic-loop/epics/<slug>/` contains:

```
state-of-epic.md        # human-facing current state
tracker.md              # task list and status
implementation-log.md   # what happened, in human-readable form
decision-log.md         # decisions and rationale
risk-register.md        # known risks
docs/                   # epic-scoped documentation
.runtime/               # machine state and debug traces (hidden from role context)
```

Human-facing artifacts and machine runtime are separated by design. Roles read the former; the latter exists for debugging and replay without polluting prompt context.

---

## Useful commands

```bash
# List local epics
node .agents/skills/epic-loop/scripts/list-epics.mjs

# Compact role-facing state for the current epic
node .agents/skills/epic-loop/scripts/role-summary.mjs --slug "<epic-slug>"

# Inspect runtime/debug state
node .agents/skills/epic-loop/scripts/debug.mjs
```

---

## Status

Experimental and actively used. The skill is the product; the rest of this repository (a Next.js app) is a fixture used to test the skill against a realistic codebase with real builds, hooks, linting, and long-running sessions.

If you're reading the source, the skill lives at `.agents/skills/epic-loop/`.

---

## Related

- [`codex-bee`](https://github.com/usulpro/codex-bee) — earlier work on long-running Codex sessions; epic-loop is the next iteration, built around the Stop hook rather than a session wrapper.

---

## License

MIT
