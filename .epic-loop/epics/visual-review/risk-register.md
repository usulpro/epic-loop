# Risk Register

| Id | Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- | --- |
| R1 | The doorbell does not work on some surfaces (VS Code extension, desktop app, Codex IDE) or session states (after Esc) | Answers need a manual nudge there | D8 gate first; universal `UserPromptSubmit` fallback; the page says "send any message" when no doorbell is available | open |
| R2 | The stop gate becomes pushy and continues the loop past real blockers | Wasted or harmful work; loss of trust | Explicit always-stop criteria (Q1); log every challenged stop with its outcome so the boundary can be tuned | open |
| R3 | Page building inside the loop is slow or expensive | Loop stalls at every gate | Subagent page builder (D4); proportionality ladder (D6); engine-owned boilerplate | open |
| R4 | The engine grows into a platform | Effort spent on tooling instead of value | "Semi-manual is enough"; promote a block only on the second real need | open |
| R5 | Server lifecycle issues: ports, orphaned processes, the Codex sandbox or `/clean` killing a server started from a shell tool | Pages unreachable, answers lost | Server owned by the CLI, started detached from a hook, pidfile and status, dynamic port | open |
| R6 | The manager's context and cost grow with its new duties | Slower, costlier housekeeping turns | Delegate to subagents; the manager reads compact summaries only | open |
| R7 | Conflict with the upcoming engineer-as-subagent and parallel-worktree epics | Rework of this layer | D15: record them and avoid contradicting decisions; adaptation belongs to those epics | open |
