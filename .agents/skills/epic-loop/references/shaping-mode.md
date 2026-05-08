# Epic Shaping Mode

## Goal

Use shaping mode to turn discussion into a durable epic: framing, docs, decisions, risks, phases, and goal-oriented tasks.

This is not a one-shot documentation generator. It is a short-iteration dialogue that grows the epic until implementation can proceed autonomously.

## Flow

1. Capture the high-level epic:
   - problem
   - desired outcome
   - scope and non-scope
   - user/customer of the result
   - constraints

2. Identify key discussion themes:
   - runtime model
   - ownership
   - data model
   - API/client contract
   - auth
   - migration
   - verification
   - operations

3. Work one theme at a time:
   - discuss briefly
   - distinguish decisions, hypotheses, and open questions
   - update docs and logs
   - move to the next important theme

4. Grow docs gradually:
   - start with a skeleton
   - add sections as topics become clear
   - split docs only when the distinction helps future work
   - keep session-readable docs under 900 lines per file; split and cross-reference when they grow larger

5. Introduce phases when there is enough clarity:
   - create coarse phases first
   - add tasks after phase intent is stable
   - avoid file-by-file implementation scripts too early
   - give every tracker task a short title and number it as `T{phase}.{task}`

## Agent Responsibility

The agent owns decomposition. The user may describe large areas or priorities, but the agent should produce the phases, tasks, acceptance criteria, and artifact updates.

If no phases exist, propose them. If phases are partial, complete them. If the conversation dives into one area, work that area without losing the overall epic map.

## Task Authoring Guardrail

Implementation tasks must not look like documentation tasks by accident.

Each implementation task must contain:

- expected system outcome: what works differently after the task
- implementation surface: schema, API, runtime, CLI, UI, sync pipeline, tests, etc.
- acceptance criteria: behavior, contract, or verification
- relevant docs

When you write the tracker line, use:

- `- [ ] T3.2 [Short Title]`
- `Kind: implementation | Status: todo`

Keep the title brief and task-shaped. Put the detailed outcome, surface, acceptance, and docs in the bullets below the task.

Weak task:

```text
Review query auth contract.
```

Strong task:

```text
Move exported query auth from project-scoped credentials to runtime-scoped tokens so exported requests resolve the selected runtime through the runtime token contract.
Surface: API contract, export runtime, generated client config, query path.
Acceptance: exported projects use the runtime token expected by the target runtime and reject mismatched credentials.
Docs: docs/export-runtime.md, docs/api-contracts.md
```

## Re-Entrant Use

Shaping can run:

- at epic start
- during implementation
- after review
- during architecture reset
- when new requirements appear
- to prepare future phases while another session implements the current phase

When shaping changes active implementation assumptions, update `state-of-epic.md`, `decision-log.md`, and `tracker.md` clearly.

After major documentation updates, run the epic artifact limit checker for the affected slug so oversized readable files are caught early.
