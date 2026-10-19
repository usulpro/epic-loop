# Implementation Manager / Techlead / Engineer Cycle

## Contents

- [Core Rule](#core-rule)
- [Canonical Runtime Behavior](#canonical-runtime-behavior)
- [Role References](#role-references)
- [Cycle Entry](#cycle-entry)
- [Turn Order](#turn-order)
- [Techlead Turn Expectations](#techlead-turn-expectations)
- [Engineer Turn Expectations](#engineer-turn-expectations)
- [Manager Turn Expectations](#manager-turn-expectations)
- [Closure Discipline](#closure-discipline)
- [Phase Closure Discipline](#phase-closure-discipline)
- [Reset Ladder](#reset-ladder)
- [Exit Conditions](#exit-conditions)
- [Prompt-Writing Rule](#prompt-writing-rule)
- [Commit Discipline](#commit-discipline)

## Core Rule

Implementation alternates between:

- `manager`: housekeeping, artifact hygiene, compaction, and implementation-entry/exit maintenance
- `techlead`: governance, closure, direction, and handoff
- `engineer`: execution of one concrete brief

One active implementation session is in exactly one submode at a time.

A slug-only resume is not permission to start implementation. The agent must read the epic state, report readiness, and wait for explicit confirmation before running the first implementation turn in that session.

## Canonical Runtime Behavior

The techlead hook prompt is intentionally compact. It should point the model to the role definition and the compact role summary rather than inlining the full role contract every turn.

- Techlead live hook prompt: [../assets/templates/implementation-techlead-prompt.md](../assets/templates/implementation-techlead-prompt.md)
- Manager role definition: [implementation-manager-role.md](implementation-manager-role.md)
- Techlead role definition: [implementation-techlead-role.md](implementation-techlead-role.md)

The role definition is the main behavioral contract. The hook prompt should stay short and operational.

## Role References

- Techlead role: [implementation-techlead-role.md](implementation-techlead-role.md)
- Manager role: [implementation-manager-role.md](implementation-manager-role.md)
- Engineer role: [implementation-engineer-role.md](implementation-engineer-role.md)

The techlead may read both role references to manage the loop and write task briefs. Engineer-facing prompts remain skill-agnostic and do not ask the engineer to read role references.

## Cycle Entry

After the user confirms implementation, activate that session for hook routing:

```bash
node <skill-dir>/scripts/bind-session.mjs --current --slug "<epic-slug>" --mode implementation
```

If another session was previously active for the same epic and mode, this binding replaces it.

Binding starts the loop with `next_role: manager`. The current user turn should stop after binding; a loaded and trusted `Stop` hook on the selected platform continues the same session with the first manager housekeeping prompt by returning `{ "decision": "block", "reason": "<prompt>" }`.

Implementation observability is permanent. Runtime/debug traces are stored under `.runtime/` for debugging and analysis only; they are not part of the normal read path for techlead or engineer.

Codex and Claude Code share the same loop core and Stop continuation shape. Platform-specific adapters handle setup, current-session lookup, and report capture: Codex reads `last_assistant_message`; Claude Code prefers `last_assistant_message` when the CLI provides it and falls back to the latest assistant text from `transcript_path` JSONL.

## Turn Order

1. The user confirms implementation in the current session.
2. The agent binds the current session to the epic and implementation mode.
3. The next `Stop` hook emits the first manager housekeeping prompt.
4. The manager performs housekeeping for implementation start, including branch-state review, baseline checks, and pending-file triage, and then stops.
5. The `Stop` hook captures the manager final message and stores it as the latest manager report. Both Codex and Claude Code immediately start the next techlead turn. Claude Code reports this reentry Stop as `stop_hook_active: true`, which is informational only; epic-loop records the report and issues the next block continuation in the same turn.
6. The techlead inspects epic state, housekeeping outcome, and live repository evidence, then decides whether to close work, continue, pause, review, detour, or reset.
7. If implementation should continue with product work, techlead writes exactly one concrete, skill-agnostic engineer brief through `write-engineer-brief.mjs` and sets the next role to `engineer`.
8. The hook starts one engineer turn and immediately pre-sets the following role to `techlead`.
9. The engineer executes that prompt, verifies the slice, reports the factual outcome, and stops.
10. The `Stop` hook captures the engineer final message and stores it as the latest engineer report. Both Codex and Claude Code immediately start the next techlead turn; a Claude Code run only pauses for `continue loop mode` when a finite Stop-hook block cap is reached.
11. When techlead explicitly requests housekeeping, the hook starts one manager turn and immediately pre-sets the following role to `techlead`.
12. When techlead wants the loop to stop, it files `request-stop.mjs --class A-F --reason ... --blocks ...`; it can no longer set `idle` (`set-next-role --role idle` is refused inside techlead and manager turns). The hook starts a manager **stop-review** turn (`assets/templates/implementation-stop-review-prompt.md`) carrying the class, reason, blocks and round.
13. The manager resolves it with `review-stop.mjs`: `--outcome accepted` sets the loop `idle` and its final message is recorded as the manager report (the stop report); `--outcome challenged --instruction "<text>"` returns to techlead, whose next prompt carries the instruction once under "Stop Request Challenged". Both log a `stop-gate` progress event (`class`, `outcome`, `instruction`, `reason`, `blocks`, `round`, `iteration`).
14. A manager turn may open a **gate** for a checked review page (`gate.mjs open`, manager turns only). A non-blocking gate changes nothing in routing. When the manager turn that opened an unanswered **blocking** gate stops, the hook records its report, sets the loop status to `awaiting-review`, logs `awaiting-review` with the review ids, and issues no continuation. While `awaiting-review`, a user message gets a note naming the waiting review page; `stop-loop.mjs` stops the loop, and `bind-session.mjs --mode implementation` resumes it from a manager turn with the gates still listed. An accepted stop review in the same turn wins (the loop goes `idle`). Gate events: `gate-opened`, `answers-submitted` (logged on any hook event of the driver session, once per `submittedAt`), `gate-ingested`, `gate-closed`.
15. **Pickup and ingest.** On every Stop of the driver session, before a techlead or engineer turn starts, the loop looks for pending human input: gates whose review has a `submittedAt` not yet ingested, and inbox entries after `inbox_through`. If there is any, a manager **ingest** turn runs first (`ingest-start` with the review and inbox ids; `implementation_loop.ingest` holds the snapshot). A loop in `awaiting-review` with pending input goes back to `running` (`review-answered`) and starts the ingest. A pending stop review runs first. When the ingest turn stops, the hook marks exactly its snapshot ingested (`gate-ingested` per review, `inbox-ingested` with `through`), and the next turn is always the techlead's, whose prompt opens with "Human Input Ingested" (the manager's report, the inbox requests verbatim, and a note if a chosen engineer turn was not run).
16. `round` counts consecutive stop requests with no engineer turn in between; handing off to an engineer resets it. Implementation end is manager end housekeeping → techlead → `request-stop --class A` → accepted review.
17. The cycle repeats until a stop review accepts a stop, a blocking gate makes it await a review, or the user stops the loop.

User messages in the driver session do not stop the loop. The loop records the host turn that carries it as `turn_key` (Claude Code `prompt_id`, Codex `turn_id`; both stay the same across Stop-hook continuations) and classifies each `UserPromptSubmit`:

- **Synthetic** (only `<task-notification>`/`<system-reminder>` blocks, e.g. background-task completions): ignored, logged as `synthetic-prompt-ignored`; the open role turn stays open. When the notification wakes an idle session it starts a new host turn, and the loop adopts its `turn_key` (`turn_key_adopted: true`). Roles may use background tasks.

A role may also end its turn to wait for a background task it started (the idiomatic Claude Code wait: end the turn and let the `<task-notification>` wake the session). The Claude Code `Stop` payload then lists the task under `background_tasks` with `status: "running"`. Unless the role has marked the turn complete, the loop logs `turn-waiting-background`, records no report, and issues no continuation. A notification or a user message wakes the same role turn with a note to continue. The role ends again if it still needs work that is running, and the loop waits again as often as that happens. When nothing it started is running, its final message is the report and the `Stop` chains as usual.

- Only tasks that were not already running when the role turn started count. The baseline comes from the `Stop` that started the turn, and a role resumed after Esc keeps the baseline of the aborted turn. So a dev server left by an earlier role never stalls the loop.
- A role that is done but leaves a process running on purpose (e.g. a dev server for the techlead) marks the turn complete with `complete-turn.mjs --slug <slug>`. The loop appends that rule to every engineer prompt. The techlead's `set-next-role` completes its turn the same way. Completion is recorded per iteration (`turn_completed_iteration`, `next_role_set_iteration`), so the loop then chains even while those tasks run.
- Time spent waiting is not active time. It is recorded as `background_wait_ms` on `turn-stop` and left out of the turn's `duration_ms`.
- Codex payloads carry no `background_tasks`, so nothing changes there.
- **While a role waits for its background work** (its last `Stop` was `turn-waiting-background`): the host turn already ended, so this is not an abort. The message is logged as `user-message-while-waiting`, and the loop adopts its `turn_key`. The agent answers briefly and continues the same role turn: it ends again if the work is still running, and otherwise ends with the full report.
- **Same `turn_key`** (the user typed while the role was working; both hosts inject it into the running turn): logged as `user-message-in-turn`; the agent answers briefly and finishes the role turn with its full report (the answer alone must not become the report), and the loop continues.
- **New `turn_key` while a role turn is open**: the user aborted that turn with Esc / Ctrl+C, which fires no `Stop` on either host. The turn is closed as `turn-aborted` without a report and with `duration_ms: null`, because when the role stopped working is unknown, and when the user's turn ends the `Stop` hook resumes the same role with a "Resuming the <role> turn" note, so the answer to the user is never taken for the role's report. Exception: if `set-next-role` already ran inside the aborted turn (same iteration), its decision is kept and the loop continues with that role instead of re-running the techlead. A missing turn identity is treated the same way.
- **No open role turn**: the agent answers, and the loop continues after the reply. Exception: when the last techlead turn ended without `set-next-role` (`next_role: awaiting-transition`), nothing would run, so the note says that and gives the `set-next-role` command to use if the user wants the loop to go on.
- **Stop request**: the agent runs `stop-loop.mjs --slug <slug>` when the user asks to stop or pause in any wording; the exact message `stop loop mode` is handled by the hook directly. Both set the loop to `interrupted` / `idle` and log `loop-stopped` with the driver session id. An open engineer or manager turn is closed as `turn-interrupted`, and the role is told to end with its report of the stopped turn (what changed, what was verified, what is left); the next `Stop` records that final message as the role report and logs `stopped-turn-report`, so the next session starts from it. A stopped techlead turn records nothing. Rebinding with `bind-session.mjs --mode implementation` restarts the loop from a manager turn.

If implementation is restarted while an older open turn exists, the old turn is closed as interrupted without inventing active duration.

Claude Code Stop hooks include `stop_hook_active`. Real Claude Code marks the Stop after a previous Stop-hook block as `stop_hook_active: true`. This flag is informational, not a hard gate: epic-loop keeps chaining roles across reentries, recording each role report and issuing the next block continuation in the same turn. This is what makes the loop run autonomously without per-role manual nudging.

Claude Code enforces a per-turn Stop-hook block cap: it overrides the hook after `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` consecutive blocks (default `8`, `0` = uncapped and recommended for long runs). Epic-loop tracks the consecutive-block count per turn, resetting it whenever a fresh user turn begins. When a finite cap is one block away from exhaustion, the loop routes to a manager communication turn as the final block and then pauses cleanly (it never lets Claude Code hit the override warning). The manager tells the user the loop paused because it is at the cap and to send `continue loop mode` when ready; that fresh turn resets the counter and the loop resumes. With `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0` this pause never happens and the loop runs fully autonomously until it goes idle.

On the first techlead turn in a newly started implementation loop, there is no previous engineer turn to close. In that case, techlead should say so explicitly, orient on epic state, use the manager housekeeping report as the baseline handoff, and choose the first honest implementation step.

## Techlead Turn Expectations

The techlead is not just a planner. It is the governing loop for:

- truth over optimistic narrative
- scope over drift and convenience edits
- direction over stale plans
- handoff quality between turns
- artifact accuracy against the real repository state

The techlead must:

1. Start from `role-summary.mjs`, then read only the additional artifacts needed for the current decision.
2. Re-ground on epic and phase context.
3. Inspect live repository evidence rather than trusting artifacts alone.
4. Review the previous engineer turn as an adversarial owner.
5. Ask pointed challenge questions when the work is suspicious, incomplete, or weakly verified.
6. Decide task closure honestly.
7. Execute the technical control duties:
   - keep `tracker.md`, `state-of-epic.md`, and `implementation-log.md` accurate
   - use task/phase scripts only when they match the visible tracker; otherwise update human-facing artifacts directly and keep moving
   - append to `implementation-log.md` with `append-implementation-log.mjs`
   - update `state-of-epic.md`
   - update `decision-log.md` and `risk-register.md` when needed
   - commit every honestly closed task
   - include task-related epic artifact updates in the task commit instead of creating standalone housekeeping commits
   - create intermediate checkpoint commits inside large, risky, or multi-step tasks when that is an intentional technical decision
8. Apply stricter standards to phase closure than task closure.
9. Choose the next move:
   - housekeeping pass
   - close and continue
   - corrective pass
   - investigation pass
   - verification pass
   - tactical detour
   - review
   - reset
   - stop request (classes A–F; a manager stop review decides)
10. Write exactly one high-quality engineer brief when implementation continues.

Housekeeping is mandatory at these moments:

- before implementation begins
- after honest phase completion
- before the final exit from implementation mode

Normal techlead flow must not read `.runtime/` logs, prompt history, progress history, hook events, or session files. Those are technical debug artifacts only.

## Engineer Turn Expectations

The engineer owns one concrete task brief and does not know about epic-loop runtime mechanics.

The engineer may be asked to run one of these task types:

- implementation slice
- investigation pass
- correction pass
- verification pass
- tactical detour pass

The engineer must:

1. Execute only the requested slice.
2. Follow existing project patterns and constraints.
3. Bring back real evidence rather than optimistic summaries.
4. Report changed files, implemented behavior, verification results, blockers, gaps, or follow-up notes.
5. Stop after the report. Routing returns to techlead automatically.

## Manager Turn Expectations

The manager owns housekeeping and stop reviews. It does not implement product code and never hands control to engineer. It ends the loop only by accepting a stop request in a stop-review turn.

The manager must:

1. Run the housekeeping pass it was asked to perform.
2. Keep artifact hygiene and compact inactive non-doc layers when appropriate.
3. Preserve active work surfaces and avoid compacting anything still needed for the current execution path.
4. Report what housekeeping was performed, what files changed, what was archived, what checks ran, and what blockers remain.
5. Stop after the report. Routing returns to techlead automatically.

## Closure Discipline

A task is not done because code was edited. It is done when:

- the intended behavior or contract changed as required
- the acceptance criteria are satisfied
- verification ran at the right level or the verification gap is explicitly recorded
- epic artifacts reflect reality
- blockers, risks, and known limitations are not hidden
- task-owned changes are committed for that closed task

Closure notes in `implementation-log.md` should minimally record:

- what changed
- why the task is considered closed or not closed
- what verification really ran
- what residual risks or limits remain
- the commit hash if a commit was made

## Phase Closure Discipline

Closing the final task of a phase does not automatically close the phase.

Phase closure requires an additional integrative review:

- reread the phase goal
- review the tasks together, not in isolation
- confirm the phase has at least one concrete `verification` task, normally the final task of the phase
- check that the phase consumes previous-phase outputs correctly
- check that the phase integrates cleanly with the existing system
- check that the phase creates adequate seams and assumptions for likely next phases
- run or require broader verification when appropriate
- detect hidden tails, missing surfaced states, docs drift, and follow-up work

Acceptable phase outcomes are:

- close the phase
- close the phase with explicit follow-ups
- keep the phase open because the outcome is not honestly complete

## Reset Ladder

When the current path becomes questionable, techlead should choose the smallest honest escalation:

- `local correction`
- `tactical detour`
- `strategic reset`

Use reset when the active architecture, roadmap, or task framing is no longer a reliable guide. Do not reset too early, but do not keep executing a stale path once structural mismatch is evident.

Bookkeeping drift is not the same as roadmap drift. If structured script state disagrees with `tracker.md` but the next visible product task is clear, continue implementation from `tracker.md` and record the bookkeeping drift instead of stopping the loop.

## Exit Conditions

Leave the implementation cycle when:

- a design assumption is invalid and needs shaping
- the roadmap is stale and needs reset
- the completed slice needs intent-level review
- verification cannot proceed without external decision
- the active phase is complete and needs milestone closure

## Prompt-Writing Rule

When techlead writes the next engineer brief, it must be:

- skill-agnostic, with no epic-loop, tracker, artifact, role-routing, handoff, or `set-next-role` instructions
- narrow enough to execute safely
- explicit about scope boundaries
- explicit about acceptance
- explicit about required evidence
- explicit about stop conditions and escalation triggers

“Continue implementation” is not a valid engineer brief.

The engineer brief should be created from scratch each turn through `write-engineer-brief.mjs`. Techlead should not inspect or edit the previous brief file.

## Commit Discipline

If a commit skill is available in the session, techlead should prefer using it. Otherwise techlead should follow the repository's normal git workflow with standard git commands.

The default target is one meaningful commit per completed task. A task commit should describe the actual product, code, docs, or verification change. Do not name the commit only after the epic, task number, task title, or tracker bookkeeping.

Apply commit discipline:

- review `git status` and relevant diffs first
- commit only task-owned changes
- treat epic artifact updates caused by closing or documenting the task as task-owned changes
- include task-related tracker, state, implementation-log, decision-log, risk-register, or task-doc cleanup in the task commit
- do not create separate commits only to capture epic housekeeping, tracker cleanup, log updates, compaction stubs, or other epic tracking files
- never sweep unrelated dirty files into the task commit
- if unrelated changes from parallel work are present, prefer excluding them and still producing a clean task-owned commit
- if it is unclear whether surrounding dirty files are safe to leave out or include, stop and ask the user rather than guessing
- do not treat a task as honestly closed until the task-owned commit exists
- create intermediate checkpoint commits during a still-open task only when the work is large, risky, multi-step, or about to branch into fixes or rollbacks, and the extra commit is a conscious technical decision
- if a commit is made, record the commit hash in `implementation-log.md`
- if an intermediate commit is made while the task remains open, record the checkpoint hash and the remaining scope
