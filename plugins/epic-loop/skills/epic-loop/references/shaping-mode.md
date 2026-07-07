# Epic Shaping Mode

## Contents

- [Goal](#goal)
- [Flow](#flow)
- [Agent Responsibility](#agent-responsibility)
- [Task Authoring Guardrail](#task-authoring-guardrail)
- [Re-Entrant Use](#re-entrant-use)

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

5. Introduce phases when there is enough clarity:
   - create coarse phases first
   - add tasks after phase intent is stable
   - avoid file-by-file implementation scripts too early

## Agent Responsibility

The agent owns decomposition. The user may describe large areas or priorities, but the agent should produce the phases, tasks, acceptance criteria, and artifact updates.

If no phases exist, propose them. If phases are partial, complete them. If the conversation dives into one area, work that area without losing the overall epic map.

Every phase must include at least one task with kind `verification`.

- Default rule: make the final task of the phase a verification task that proves the combined outcome of the whole phase.
- Optional stronger rule: add intermediate verification tasks after risky tasks when earlier proof is needed to prevent drift, wasted implementation, or hard-to-debug failures later.

## Task Authoring Guardrail

Implementation tasks must not look like documentation tasks by accident.

Each implementation task must contain:

- expected system outcome: what works differently after the task
- implementation surface: schema, API, runtime, CLI, UI, sync pipeline, tests, etc.
- acceptance criteria: behavior, contract, or verification
- relevant docs

Task-detail docs should stay narrow by default.

- If a task needs more explanation than fits cleanly in the tracker, create a separate task doc instead of overloading the tracker entry.
- Prefer one doc per task over one large combined doc.
- Use a shared doc only when two or three tasks genuinely share the same narrow scope, principles, or an intentionally paired relationship such as implementation plus validation.
- It is valid for one task to reference multiple docs, for example one shared principles doc and one task-specific spec.
- The guiding rule is context minimization: each task should pull in as little irrelevant information as possible.

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

Verification tasks must be concrete too.

Weak verification task:

```text
Verify the API works.
```

Strong verification task:

```text
Verify exported search requests resolve against the selected runtime token contract.
Method: start the local runtime, obtain an authenticated request path, send real query requests with valid and mismatched tokens, and inspect both HTTP responses and search side effects.
Tools: local dev server, curl or httpie, seeded project data, auth/session bootstrap, runtime logs.
Evidence: valid token returns expected search payload; mismatched token returns the contract error; runtime logs show the resolved runtime.
Cleanup: remove temporary debug log lines added only for this verification.
Docs: docs/export-runtime.md, docs/api-contracts.md
```

More reliable verification methods to suggest when shaping `verification` tasks:

- API contracts: real requests through the public or internal interface with explicit auth, environment bootstrap, and response assertions.
- Browser UI: Playwright or Chrome MCP flows with a real session and observable DOM, navigation, or screenshot evidence.
- Background behavior: logs, DB queries, queue state, files, webhooks, or other runtime artifacts that prove async work really happened.
- CLI or generators: actual command execution plus stdout/stderr, exit code, and artifact inspection.
- Hidden behavior: temporary console/file debug output is acceptable if the task also says how that instrumentation is cleaned up after the evidence is collected.

## Re-Entrant Use

Shaping can run:

- at epic start
- during implementation
- after review
- during architecture reset
- when new requirements appear
- to prepare future phases while another session implements the current phase

When shaping changes active implementation assumptions, update `state-of-epic.md`, `decision-log.md`, and `tracker.md` clearly.
