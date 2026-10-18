# Sandbox run: manager stop gate on Claude Code, rerun after fixes (2026-10-18)

Run 6 of the `sandbox-test` skill. Target: branch `feature/manager-stop-gate` at `f752633` (unpublished), local-CLI install. Same scenario as [run 5](../2026-10-18-stop-gate-claude/log.md).

Questions this run answers:

- [FEATURE] With independent work left, does the techlead now file the npm-publish task (B) as a stop request, does the manager queue it and challenge with the `on-hold` command, and does the task end up `on-hold` with `Hold: human-action (H<n>)` instead of `blocked`?
- [FEATURE] Does the loop continue on the independent work and stop only when nothing independent is left (F-related)?
- [FEATURE] Does the manager commit every accepted stop's report in its own `docs(epic): stop report NN (class X)` commit, leaving no `stop-reports/` file uncommitted?
- [FEATURE] Regression: six-heading reports, German chat with English saved copy, rebind in run 2 and a final class A stop.
- [SANDBOX] Rerun with the identical fixture commit and prompts (only the skill changed), as D-12 intends for fair comparisons.

Layout:

- Sandbox (disposable): `<workspace>/sandbox-stop-gate-claude-rerun/`
- Heavy artifacts (local only): `<workspace>/sandbox-logs/2026-10-18-stop-gate-claude-rerun/artifacts/`
- Fixture: run 5's fixture repo (`95d0f6f`), cloned unchanged.
- Driver: `driver/` is run 5's driver with paths changed only; the prompts are byte-identical.

## Journal

### 1. Roll-out

- [SANDBOX] DECISION: reuse run 5's fixture commit and prompts unchanged; `driver/run-session.sh` and `driver/archive.sh` differ from run 5's only in the sandbox, logs and transcript paths.

### 2. Checks without an agent

- [FEATURE] PASS: local-CLI install; skill copy identical to the branch source at `f752633` (`artifacts/run1/01-install.txt`); doctor `ready` with block cap 0 (`artifacts/run1/02-doctor.json`); the port holder listened on `*:4317`.

### 3. Headless agent session

#### Run 1 (`artifacts/run1/`)

- [SANDBOX] OBSERVATION: `driver/run-session.sh run1`: success, 99 turns, 363 s, $3.36.
- [FEATURE] PASS (check 1): with the README and the Phase 1 verification still independent, the techlead filed `request-stop --class B` for the publish task ("needs the product owner's npm login and explicit publish authorization"). The manager queued H1 (human-action) and **challenged** (round 1) with: "Independent work remains. H1 queued for the npm publish. Run: `…/set-task-status.mjs --slug report-export --task-id phase-1-task-5 --status on-hold --hold-kind human-action --hold-item H1` — then continue with phase-1-task-6 (README …), followed by phase-1-task-7 (Phase 1 verification …)". The tracker then showed `Status: on-hold` with `  - Hold: human-action (H1)` right under the task line. No task was ever `blocked`.
- [FEATURE] PASS (check 2): the loop continued (README, Phase 1 verification), then the techlead filed `request-stop --class F` for the footer (tier names, no default). Nothing independent was left, so the manager accepted it (round 1), queued H2 (product-decision) and H3 (port, human-action) and saved `stop-reports/01-2026-10-18-class-F.md`.
- [FEATURE] PASS (check 3): the manager committed the report itself: `b175aa5 docs(epic): stop report 01 (class F)`, containing exactly `human-queue.md` and `stop-reports/01-…` (decision-log had no change in that review). `git status` at the end of run 1: only the untracked `.claude/` install.
- [FEATURE] PASS (regression): report 01 has the six headings, is English, and lists H1–H3 and agent-made D1 with how to confirm or reverse; the chat message is German; `latest-manager-report.md` holds the English copy.
- [FEATURE] OBSERVATION: as in run 5, C, D and E were resolved by the techlead without stop requests (agent-made D1, ephemeral-port check, reorder). This time the techlead also kept the serve task `partially-satisfied` and noted the deferred 4317 check in Phase 1 verification.
- [SANDBOX] OBSERVATION: `tools/loop-watch.mjs` does not print `stop-gate` events (it predates them); the Monitor showed the `request-stop` commands, and the outcomes were read from `progress-log.jsonl`.
- [SANDBOX] OBSERVATION: acting as the human: resolved H1 (publish deferred outside the epic), H2 (Basic, Pro, Team), H3 (the other-port check is enough) with `human-queue.mjs resolve`; killed the port holder. The resolutions leave `human-queue.md` modified for the next session to commit.

#### Run 2 (`artifacts/run2/`)

- [SANDBOX] OBSERVATION: `driver/run-session.sh run2`: success, 77 turns, 389 s, $2.42. The session rebound from a fresh capture.
- [FEATURE] PASS (check 4): the loop applied H1–H3 (serve closed, publish `deferred`, the human's queue resolutions committed with the first task commit `9744859`), built the footer (Basic, Pro, Team), verified and closed Phase 2, ran implementation-end housekeeping and filed `request-stop --class A`; the manager accepted it and committed `5770c16 docs(epic): stop report 02 (class A)` (the report only; no queue or decision changes in that review). `git status` at the end: only the untracked `.claude/` install. Sandbox tests 5/5.
- [FEATURE] PASS (regression): report 02 has the six headings and is English; the chat message is German ("# Stoppbericht 02 (Klasse A)").

#### Stop-gate events (both sessions)

| Session | Class | Outcome | Round | Report and commit |
| --- | --- | --- | --- | --- |
| 1 | B (npm publish) | challenged: H1 queued, exact on-hold command, continue with README and Phase 1 verification | 1 | none |
| 1 | F (tier names) | accepted (nothing independent left) | 1 | `01-2026-10-18-class-F.md`, `b175aa5` |
| 2 | A (epic done) | accepted | 1 | `02-2026-10-18-class-A.md`, `5770c16` |

#### Stop-report checklist

| Check | 01 (F) | 02 (A) |
| --- | --- | --- |
| Six required headings | yes | yes |
| Against the desired outcomes; outcomes, not files | yes | yes |
| Human queue with defaults and what each blocks | yes (H1–H3) | yes |
| Agent-made decisions with confirm or reverse | yes (D1) | yes |
| Next and the resolved resume command | yes | yes |
| English copy, German chat, copy recorded as the manager report | yes | yes |
| Committed by the manager in its own `docs(epic): stop report NN (class X)` commit | yes | yes |

#### Run 5 vs run 6 (same fixture, same prompts)

| Behaviour | Run 5 (before `f752633`) | Run 6 (after) |
| --- | --- | --- |
| B filed while independent work was left | no; task set `blocked` | yes; challenged with the on-hold command |
| Waiting task status | `blocked`, no H item until the end | `on-hold` with `Hold: human-action (H1)` |
| Stop requests | 1 combined (B covering F and D) + A | B (challenged), F (accepted), A (accepted) |
| Challenge path exercised in a real run | no | yes (B) |
| Stop reports committed | no (picked up by the next task commit; final one never) | yes, each by the manager, own commit |
| Cost (two sessions) | $6.15 | $5.78 |

### 4. Fixes

- [FEATURE] None needed: both fixes of `f752633` behaved as intended.

### 5. Archive and cleanup

- [SANDBOX] PASS: `driver/archive.sh`: bundle verified and restore-tested (5/5 tests); `.epic-loop/` with `.runtime/`, `.claude/settings.json` and the host transcripts in `artifacts/90-archive/`; sandbox and its `~/.claude/projects/…` entry removed.
- [SANDBOX] OBSERVATION: inventory: no leftover processes (the loop-watch Monitor stopped), port 4317 free, no `~/.claude.json` entry for the sandbox path, npx cache untouched. Local artifacts: 4.9 MB.

## Summary

### [FEATURE]

- PASS on all four checks. With the fixed skill and unchanged prompts, a human-dependent task found mid-loop goes through the gate: the B request was challenged with the exact `on-hold` command, the task went `on-hold` with its H id, the loop continued on independent work and stopped only on F. Every accepted stop's report was committed by the manager in its own commit, and both sessions ended with a clean tree.
- The manager's challenge path ran in a real session for the first time (class B).
- Still open from run 5: C, D and E are resolved by the techlead before any stop request, so their challenge branches have only unit-test evidence.

### [SANDBOX]

- Rerunning the same fixture commit with byte-identical prompts isolated the effect of the product change cleanly (run 5 vs run 6 table).
- `tools/loop-watch.mjs` does not print `stop-gate` events; reading `progress-log.jsonl` filled the gap. Worth adding to the tool next time it is touched.
