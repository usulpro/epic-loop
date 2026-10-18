# Sandbox run: manager stop gate on Claude Code (2026-10-18)

Run 5 of the `sandbox-test` skill. Target: branch `feature/manager-stop-gate` (unpublished), local-CLI install.

Questions this run answers:

- [FEATURE] Does a techlead stop always go through a manager stop review, and does the review follow the per-class rules (A accept; B/F queue and continue, or accept when nothing independent is left; C take the default as an agent-made decision; D work around or defer; E never a stop; round 2 accepted)?
- [FEATURE] Does the loop continue for B, C, D and E, stop for F in run 1 (with the B item queued and its task `on-hold`), and stop for A at the end of run 2?
- [FEATURE] Does every accepted stop save an English stop report with the six headings, while the chat message is in the user's language (German here)?
- [SANDBOX] First headless run with a hand-shaped fixture epic committed in the fixture repo, and a two-session scenario (stop, human answers, rebind) in one sandbox.

Layout:

- Sandbox (disposable): `<workspace>/sandbox-stop-gate-claude/`
- Heavy artifacts (local only, not in git): `<workspace>/sandbox-logs/2026-10-18-stop-gate-claude/artifacts/`
- Fixture repo (local only): `<workspace>/sandbox-logs/2026-10-18-stop-gate-claude/fixture/` (commits `d9cb366` project, `95d0f6f` shaped epic)
- Driver (committed): `driver/run-session.sh`, `driver/prompt-run1.txt`, `driver/prompt-run2.txt`

## Journal

### 1. Roll-out

- [SANDBOX] DECISION: install from the branch through the local CLI (`node packages/cli/src/cli.mjs install --platform claude-code`, dev overrides and the block cap unset), not npm: the code under test is unpublished. This deviates from D-2 on purpose, as in runs 3 and 4.
- [SANDBOX] DECISION: the fixture epic is shaped by hand and committed in the fixture repo (tracker with 7 Phase 1 tasks and 2 Phase 2 tasks, problem framing, state). Each stop class has a natural trigger in the task text: E (export command ordered before `formatRow`), C (date format with ISO 8601 as the usual default), D (port 4317 fixed by contract, held by a foreign `node` listener), B (npm publish needs the owner's login), an independent README task after it, F (pricing tier names, no default, blocks all Phase 2 work). A is the end of run 2.
- [SANDBOX] DECISION: safety for the publish task: the fixture `package.json` is `"private": true` and the allowlist has `Bash(npm test:*)` instead of `Bash(npm:*)`, so a real `npm publish` cannot run even if the user's `~/.npmrc` holds a token.
- [SANDBOX] DECISION: the session prompts are in German, so the stop report's language rule (chat in the user's language, saved copy English) is exercised; artifacts must stay English.
- [SANDBOX] OBSERVATION: pre-flight in a throwaway clone: install OK, skill copy identical to `plugins/epic-loop/skills/epic-loop`, doctor `ready` with `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0`.

### 2. Checks without an agent

- [FEATURE] PASS: install through the local CLI; the skill copy is identical to the branch source (`artifacts/run1/01-install.txt`); doctor `ready` (`artifacts/run1/02-doctor.json`).
- [SANDBOX] OBSERVATION: the foreign port holder (`node -e "net.createServer().listen(4317)"`, started by `driver/run-session.sh`) listened on `*:4317` before the session started.

### 3. Headless agent session

#### Run 1 (`artifacts/run1/`)

- [SANDBOX] OBSERVATION: `driver/run-session.sh run1`: `claude -p` (German prompt), `--setting-sources project --permission-mode acceptEdits`, allowlist `Read Edit Write Glob Grep Monitor Bash(node:*) Bash(npx:*) Bash(git:*) Bash(npm test:*) Bash(ls:*) Bash(cat:*) Bash(head:*) Bash(wc:*) Bash(curl:*)`, `--max-budget-usd 15`, `timeout 50m`, block cap 0. Result: success, 125 turns, 494 s, $3.70. The loop chained manager → techlead/engineer × 7 tasks → stop request → manager stop review → idle, all in one session.
- [FEATURE] FINDING (E): the techlead never filed an E stop. On the first turn it reordered the tracker itself (`formatRow` before the export command) and continued. That matches D16 ("E is never a stop"), but the gate was not exercised for E.
- [FEATURE] FINDING (C): the techlead never filed a C stop. It took the ISO 8601 default itself and recorded it with `agent-decision.mjs add`: `decision-log.md` D1 "Export date format" (agent-made, stop class C, unconfirmed). PASS for the outcome (agent-made decision recorded, loop continued); the gate was not exercised for C.
- [FEATURE] FINDING (D): the techlead never filed a D stop for the busy port either. The engineer verified the server on `PORT=48317` and the techlead marked the serve task `partially-satisfied`, deferring the 4317 check. Outcome matches D16 (work around, continue); gate not exercised for D.
- [FEATURE] FINDING (B, on-hold): with independent work left (README, Phase 1 verification), the techlead set the publish task to `Status: blocked` and moved on, without a human-queue item and without `on-hold`. `blocked` is reserved for technical blockers (D26). The loop continued correctly, but the human-wait status was wrong and the item reached the queue only at the final stop review. `on-hold` / `Hold:` was never used in the run.
- [FEATURE] PASS (gate, B/F): when nothing independent was left, the techlead filed one combined `request-stop --class B` (reason names B, F and D). The manager stop review accepted it (round 1, correct: nothing independent left), queued H1 (publish, human-action), H2 (tier names, product-decision) and H3 (port, human-action, with a default), and saved `stop-reports/01-2026-10-18-class-B.md`. `stop-gate` event with `report_path` in `progress-log.jsonl`.
- [FEATURE] FINDING (class): F was filed as part of a B request rather than as its own F request. Both rules lead to the same outcome here.
- [FEATURE] PASS (language, D9): the final chat message is the stop report in German ("## Wo das Epic steht" …); the saved copy is English and is what `latest-manager-report.md` holds.
- [FEATURE] FINDING (commit): after the accepted stop, `human-queue.md` and `stop-reports/` are left uncommitted in the sandbox. The manager does not commit; the next task commit has to pick them up.
- [SANDBOX] OBSERVATION: acting as the human between runs: copied the epic state to `artifacts/run1/after-run1-epic-loop/`, resolved H1 (publish deferred, outside the epic), H2 (tiers Basic, Pro, Team) and H3 (accept the 48317 check) with `human-queue.mjs resolve`, killed the port holder.


#### Run 2 (`artifacts/run2/`)

- [SANDBOX] OBSERVATION: `driver/run-session.sh run2` in the same sandbox (German prompt: the answers are in `human-queue.md`, D1 left open, rebind with `bind-session.mjs --current --slug report-export --mode implementation`). Result: success, 82 turns, 463 s, $2.45. The rebind worked from a fresh `UserPromptSubmit` capture.
- [FEATURE] PASS: the loop applied H1–H3 (serve task closed on the accepted 48317 check, publish task `deferred`), closed Phase 1 with phase-closure housekeeping, built the footer with the tier names in order (Basic, Pro, Team), verified Phase 2 (8/8 tests), ran implementation-end housekeeping, then filed `request-stop --class A`. The manager accepted it (round 1) and saved `stop-reports/02-2026-10-18-class-A.md`; the loop went idle.
- [FEATURE] PASS: run 2's first task commit (`2511256`) picked up run 1's uncommitted `human-queue.md` and `stop-reports/01-…`. The final stop report `02-…` is still uncommitted at the end (same finding as run 1, now at epic end).
- [FEATURE] OBSERVATION: the techlead recorded a second agent-made decision itself (D2, footer wording); stop report 02 lists D1 and D2 with how to confirm or reverse each.

#### Stop-gate events (both runs)

| Run | Class filed | Outcome | Round | Report |
| --- | --- | --- | --- | --- |
| 1 | B (reason covers B, F, D) | accepted (nothing independent left) | 1 | `stop-reports/01-2026-10-18-class-B.md` |
| 2 | A | accepted | 1 | `stop-reports/02-2026-10-18-class-A.md` |

No challenge happened: every stop the techlead filed was a real one. C, D and E were resolved by the techlead before any stop request.

#### Stop-report checklist (`docs/stop-gate.md` "Stop Report")

| Check | 01 (class B) | 02 (class A) |
| --- | --- | --- |
| Six required headings | yes | yes |
| Where the epic stands, against the four desired outcomes | yes | yes |
| Achieved since last report, as outcomes (not files) | yes ("since the loop started") | yes (since report 01; commit ids listed as a pointer) |
| Why it stopped, one or two lines, class in plain words | yes (B with F) | yes (A) |
| Human queue with defaults and what each blocks | yes (H1–H3, H3 with default) | yes ("Nothing", plus the deferred publish note) |
| Agent-made decisions with how to confirm or reverse | yes (D1) | yes (D1, D2) |
| Next and the resolved resume command | yes | yes |
| Saved copy English; chat in the user's language (German) | yes / yes | yes / yes |
| Saved copy recorded as the manager report | yes | yes |

### 4. Fixes

- [FEATURE] None. Every finding is a prompt or design question for the epic, not a small bug (see Summary).

### 5. Archive and cleanup

- [SANDBOX] PASS: `driver/archive.sh`: bundle created, verified and restore-tested (8/8 tests), `.epic-loop/` tree with `.runtime/`, `.claude/settings.json` and the host transcript directory copied to `artifacts/90-archive/`; sandbox and `~/.claude/projects/-projects-my-projects-epic-loop-workspace-sandbox-stop-gate-claude` removed.
- [SANDBOX] OBSERVATION: inventory: no leftover processes (port holder killed between runs, state-history killed by the launcher trap, loop-watch monitors stopped), port 4317 free, no `~/.claude.json` entry for the sandbox path, npx cache untouched. Local artifacts: 5.7 MB.

## Summary

### [FEATURE]

- PASS: the stop gate works end to end on Claude Code. Two techlead stop requests (B, A) both went through a manager stop review; neither run ended any other way. Both reviews applied the class rules correctly (accept when nothing independent is left; accept A). Both accepted stops saved a complete English report that became the manager report, with the chat in German.
- PASS: the B/F items reached the human queue with stable ids (H1–H3), the C default was recorded as agent-made (D1, later D2), and the loop resumed after the human answered.
- FINDING 1 (prompts, coverage): the techlead resolved C, D and E itself before filing any stop request (agent-made decision, port workaround, reorder). That is the D16 outcome, but it means the gate's challenge path was never exercised in a real run. Proving challenges needs a fixture where the techlead does file a C/D/E request.
- FINDING 2 (prompts, on-hold): with independent work left, a task waiting on the human was set to `blocked` (not `on-hold`) and no H item was created until the final stop review. `on-hold` / `Hold:` was never used. The techlead prompt tells it what to do after a challenge, but not that a human wait discovered mid-loop must be queued and put `on-hold` without a stop.
- FINDING 3 (design, commit): an accepted stop leaves its `stop-reports/NN-…` file (and any queue items the manager added) uncommitted. Mid-epic the next task commit picks them up; at the epic end the final report stays uncommitted.
- FINDING 4 (minor): one stop request covered B, F and D under class B. The rules gave the right outcome, but the event records one class.

### [SANDBOX]

What worked:

- A hand-shaped fixture epic committed in the fixture repo plus a two-session scenario (stop, the driver acts as the human with `human-queue.mjs resolve`, rebind) ran cleanly in one sandbox for $6.15 and about 16 minutes in total.
- German session prompts exercised the language rule without touching committed artifacts; artifacts stayed English.
- `"private": true` plus `Bash(npm test:*)` instead of `Bash(npm:*)` kept a publish task safe.

What changes in `LEARNINGS.md`: confirmations for the tiny fixture, pre-answered prompts, progress-log reconstruction, the bundle restore test and loop-watch monitoring; new decision D-12 (pre-shaped fixture epics, two-session stop/resume scenarios, safety for irreversible fixture tasks); a new tuning note: a natural fixture does not force a given stop class, so challenge paths need a fixture designed to make the techlead file them.
