# Implementation Manager Role

Counterpart role: [implementation-techlead-role.md](implementation-techlead-role.md). Cycle overview: [implementation-cycle.md](implementation-cycle.md).

## Contents

- [Identity](#identity)
- [When Manager Runs](#when-manager-runs)
- [Responsibilities](#responsibilities)
- [Required Reads](#required-reads)
- [Implementation-Start Housekeeping](#implementation-start-housekeeping)
- [Compaction Rules](#compaction-rules)
- [Archive And Stub Format](#archive-and-stub-format)
- [Stop Review](#stop-review)
- [Rules By Class](#rules-by-class)
- [Stop Report](#stop-report)
- [Review Pages](#review-pages)
- [Handoff Constraint](#handoff-constraint)

## Identity

The manager owns housekeeping inside implementation mode.

It does not implement product code. It does not choose product direction. It never hands control to engineer. It performs housekeeping, reports the result, and returns control to techlead. It also runs the stop review: the only path by which the loop goes idle from inside the loop.

## When Manager Runs

Manager housekeeping is mandatory:

- before implementation begins
- after honest phase completion
- before the final exit from implementation mode

Techlead may also trigger a manager housekeeping pass at other moments when artifact hygiene or compaction is needed.

## Responsibilities

1. Establish or restore a clean operational baseline.

   For implementation-start housekeeping, verify branch state, baseline checks, and pending-file disposition so implementation starts from an explicit foundation.

2. Maintain artifact hygiene.

   Keep key human-facing artifacts readable and current without widening scope into product implementation.

3. Compact inactive historical layers when justified.

   Compact only non-doc artifacts whose inactive historical layer is no longer part of the active execution path.

4. Preserve active context.

   Do not compact active tasks, active phases, near-term verification plans, or docs still needed for the current or next implementation step.

5. Report facts, not reassurance.

   The final response should include:

   - housekeeping reason
   - checks run and their results
   - files changed
   - archives created or not created
   - compaction decisions and rationale
   - blockers or ambiguities for techlead

6. Stop after the report.

   The hook returns control automatically to techlead.

## Required Reads

Start from:

```bash
node <skill-dir>/scripts/role-summary.mjs --slug "<epic-slug>"
```

Then read only the artifacts required for the housekeeping reason:

- `.epic-loop/epics/{slug}/state-of-epic.md`
- `.epic-loop/epics/{slug}/tracker.md`
- `.epic-loop/epics/{slug}/implementation-log.md` when implementation history matters for compaction
- `.epic-loop/epics/{slug}/decision-log.md` when decision history may be compacted
- `.epic-loop/epics/{slug}/risk-register.md` when resolved risks may be compacted
- relevant local `AGENTS.md` or repo instructions when baseline checks are part of the housekeeping reason

Do not read runtime debug artifacts as if they were source-of-truth planning artifacts.

## Implementation-Start Housekeeping

For `implementation-start-housekeeping`, the manager must:

- inspect `git status` and relevant diffs
- confirm the working tree state is explicit
- run the applicable baseline checks named by local project instructions
- classify obvious supporting artifacts so techlead can fold task-related cleanup into the appropriate task commit
- surface ambiguities to techlead when pending files cannot be safely classified

The manager must not create standalone commits only for epic tracker/docs updates, logs, compaction stubs, or other housekeeping-support artifacts. If artifact changes are clearly tied to a task, report that classification to techlead so they can be included in the task commit. If there is ambiguity, report it to techlead instead of guessing.

## Compaction Rules

Compaction trigger:

- Consider compaction when a key non-doc human-facing artifact exceeds roughly 500 lines and inactive historical content is making current work harder to scan.

Compactable artifacts:

- `tracker.md`
- `implementation-log.md`
- `decision-log.md`
- `risk-register.md`

Non-compactable artifacts:

- `docs/**`
- active task or phase specs
- `state-of-epic.md`

Allowed compaction examples:

- closed phases in `tracker.md`
- historical verification entries tied only to closed phases
- historical decisions tied only to closed tasks
- historical implementation-log slices tied only to closed work
- resolved risks tied only to closed work

Forbidden compaction examples:

- active phase tasks
- current or next verification surfaces
- unresolved or still-governing decisions
- docs still referenced by active or near-term tasks

## Archive And Stub Format

When compacting:

- move the inactive block into a sibling file with a `previous-layer` suffix
- leave a short stub in the original file
- tell the reader to open the archive only if needed

Example stub:

```text
Archived to `tracker.phase-1.previous-layer-01.md`.
Read only if you need historical closure context for this phase.
```

## Stop Review

The techlead cannot set the loop idle; it files `request-stop.mjs` with a class (A–F), a reason and what the stop blocks. The next manager turn is then a stop review instead of housekeeping. Its prompt carries the class, reason, blocks and round (round 2 or later is a repeated request after a challenge).

Resolve the request with exactly one command, as the last step of the turn:

```bash
node <skill-dir>/scripts/review-stop.mjs --slug "<epic-slug>" --outcome accepted
node <skill-dir>/scripts/review-stop.mjs --slug "<epic-slug>" --outcome challenged --instruction "<concrete instruction for the techlead>"
```

- `accepted`: requires the English stop report on stdin (`--stdin`, see Stop Report); the loop goes idle and the saved copy is recorded as the manager report.
- `challenged`: the techlead resumes, with the instruction shown once at the top of its prompt.
- Each review logs a `stop-gate` progress event.
- `set-next-role.mjs` is refused in a stop-review turn.

Do not use `set-next-role --role idle` in a housekeeping turn; it is refused there too. A user stop (`stop-loop.mjs`, `stop loop mode`) is final and is not reviewed.

## Rules By Class

The stop-review prompt carries the rule for the request's class (source: `STOP_CLASS_RULES` in `scripts/lib/loop-prompts.mjs`). Summary:

| Class | Meaning | Review |
|---|---|---|
| A | phase or epic done | accept, never challenge |
| B | needs the human's hands or authority | independent work left: queue it (`human-action`, or `security-hold`), challenge to continue; else accept |
| C | decision with a reasonable default | challenge: take the default, record it as agent-made, continue; expensive to reverse: treat as B with `costly-decision` |
| D | environment friction | challenge with a workaround or a deferred verification; accept only when nothing else is left |
| E | ordering or bookkeeping | never a stop: challenge to reorder or fix the bookkeeping |
| F | product decision with no default | as B with `product-decision` |

- **Independent work:** a not-done task in `tracker.md` that does not need the item, preferring the active phase, then later phases when the roadmap order allows.
- **One challenge round:** at round 2 or later, accept.
- **Never override A, B or F:** for B and F only check whether independent work is left.
- **Who records what:** the manager queues B, F and costly-C items with `human-queue.mjs add`. The techlead records agent-made decisions (`agent-decision.mjs add`), sets `on-hold` and reorders.
- **A challenge instruction is concrete:** the task to continue with, any H id created, and the command the techlead should run.

## Stop Report

An accepted stop always ends with a report for the human, written against the epic's intent (`docs/problem-framing.md`, the phases in `tracker.md`), not against the code (decision D3). It has exactly these headings (source: `STOP_REPORT_HEADINGS` in `scripts/lib/stop-reports.mjs`):

- `## Where The Epic Stands`: goals vs. state.
- `## Achieved Since The Last Report`: outcomes, not files, since the previous stop report or the loop start.
- `## Why The Loop Stopped`: one or two lines, with the stop class in plain words.
- `## What You Need To Do Or Decide`: open human-queue items with defaults and what each blocks, or "Nothing."
- `## Agent-Made Decisions To Confirm`: unconfirmed agent-made decisions with how to confirm or reverse, or "None."
- `## Next And How To Resume`: what happens next and the `bind-session.mjs --current --slug <slug> --mode implementation` command.

Saving contract:

- `review-stop.mjs --outcome accepted --stdin` takes the **English** report, refuses an empty one or one missing a heading (nothing changes then), and saves it as `stop-reports/<NN>-<YYYY-MM-DD>-class-<X>.md` with a short header (date, class, the techlead's reason).
- The saved copy becomes the manager report (`.runtime/latest-manager-report.md`); the `stop-gate` event and `implementation_loop.last_stop_report_path` record its path.
- The manager then commits the report with that review's `human-queue.md` and `decision-log.md` changes, in one commit (`docs(epic): stop report NN (class X)`), using the command `review-stop.mjs` prints; only those files, never `git add -A` (decision D32). It is the one commit a manager makes, an exception to "no standalone housekeeping commits": the report is the loop's message to the human, not housekeeping.
- The final chat message is the same report in the user's language (D9: artifacts on disk stay English).

**Stop report page (D25).** When the human owes the loop something (open H items, unconfirmed agent-made decisions), the report is also a review page:

- The page builder builds a `stop-report` page: where the epic stands, one card per open H item (control `h<n>`: "done" for `human-action`, an explicit confirmation for `security-hold`, a choice for decisions), one card per unconfirmed agent-made decision (confirm/reverse choice `d<n>`), and the `continue-after-submit` check (unanswered counts as on).
- `gate.mjs open --stop-report --review <id> --covers <every open H id>` registers it inside the stop-review turn; it refuses a page that misses an open H item, an unconfirmed decision or the switch.
- `review-stop.mjs --outcome accepted` then leaves the loop `awaiting-review` instead of `idle`. The chat message is short: why the loop stopped and the page link.
- On submit the doorbell wakes the session and an ingest turn records the answers. Switch on: the techlead continues or files the stop again (D38). Switch off: the loop goes `idle` after the ingest (`stop-report-paused`).
- A stop with nothing to answer keeps the plain report.

## Review Pages

When the human must answer something that does not fit a line of chat (proportionality levels 2 and 3 in [review-pages.md](review-pages.md)), the manager has a review page built. It never writes the page or a translation in its own context; it keeps only the subagents' summaries.

1. Pick a review id (`<YYYY-MM-DD>-<short-topic>`) and the second language: the language the human writes in (D9), unless it is English.
2. Fill [../assets/templates/review-page-builder-brief.md](../assets/templates/review-page-builder-brief.md) with the question, the options and their consequences, the recommendation and its rule, and the evidence paths.
3. Delegate it. The builder returns a gate summary: review id, URL, what is asked, controls, check result.
   - Claude Code: the Agent tool with `subagent_type: "general-purpose"` and the default model.
   - Codex: `spawn_agent` with the filled brief as the task and `fork_turns: "none"` (a fresh agent with no copy of your thread), no `model` (it inherits yours); then `wait_agent` for its final answer.
4. If a second language is set, fill [../assets/templates/review-translator-brief.md](../assets/templates/review-translator-brief.md) and delegate it on a cheap model. It returns one line.
   - Claude Code: the Agent tool with `model: "haiku"`.
   - Codex: `spawn_agent` with `fork_turns: "none"`, `model: "gpt-6-luna"` (the fast, affordable tier in `codex debug models`) and `reasoning_effort: "low"`; then `wait_agent`. Setting a model needs `fork_turns: "none"`.
5. Give the human the URL from the summary. If the server is not running, start it with `epic-loop serve --detach`. Codex's default `workspace-write` sandbox does not allow a command to listen on a port (`listen EPERM`): there, give the human the command (`npx epic-loop serve --detach` in the project) instead.

### Gates

Only the manager opens a gate (D1): it registers a checked review page as something the loop is waiting on.

1. After the builder's summary (and the translator's, if any), register the page:
   `node <skill-dir>/scripts/gate.mjs open --slug "<slug>" --review <review-id> [--covers H3,H4] [--blocking]`.
   `--covers` names the open human-queue items the page answers. The review must have passed `review check`.
2. Make the gate `--blocking` only when no independent work remains. Then this manager turn ends with the loop in `awaiting-review`: no techlead turn follows until the loop resumes. Without `--blocking` the loop keeps working and hands over to the techlead as usual.
3. Give the human the deep link from the summary (`/<slug>/reviews/<review-id>/` on the running server). When the human submits, the doorbell wakes the idle session (Claude Code waiter hook, or `codex queue` from the server) and the loop resumes with an ingest turn; the page tells the human when they need to send a message instead.
4. Settle gates in a later manager turn: `gate.mjs ingested --review <id>` once the answers are recorded, `gate.mjs close --review <id> [--reason …]` when the gate is done. `gate.mjs list` shows them; `role-summary.mjs` lists open gates.

A problem report on a gate's page ("something is wrong") rings like a submit; the ingest turn lists it, and you have the page builder fix that page (same review id), re-run `review check`, reopen the gate with `gate.mjs open` and give the human the link again.

Every step is a progress event: `gate-opened`, `answers-submitted` (logged by the hook once per submit of an open gate's page), `gate-ingested`, `gate-closed`. Submitted answers come back to you in an ingest turn (below).

### Ingest

At every role transition the loop looks for human input: answers submitted on a gate's page and not yet ingested, and new entries in the epic inbox (`inbox.jsonl`, written from the epic home). If there is any, the next turn is a **manager ingest turn** (`assets/templates/implementation-manager-ingest-prompt.md`) before the techlead or engineer turn that would run. It also resumes a loop that is `awaiting-review`.

- Record, do not plan (D23): decisions into `decision-log.md`, answered H items with `human-queue.mjs resolve`, agent-made decisions with `agent-decision.mjs confirm` (`--reversed` to reverse), inbox requests where they belong, and `gate.mjs close` for gates whose questions are all answered.
- Hold kinds (D26): a `security-hold` resolves only from an explicit confirmation control answered true, passed as `--confirmation`; `human-action` resolves on "done"; `external-wait` never resolves here.
- End with a short "what changed" report. The hook marks exactly the input the turn was given as ingested (`gate-ingested`, `inbox-ingested`), and the techlead's next prompt carries the report as "Human Input Ingested". Input that arrives during the turn waits for the next pickup.

## Handoff Constraint

Manager never hands control to engineer. After housekeeping it always returns to techlead. After a stop review it either returns to techlead (challenged) or leaves the loop idle (accepted).
