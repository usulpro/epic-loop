# Sandbox run: manager stop gate on Codex (2026-10-18)

Run 7 of the `sandbox-test` skill. Target: branch `feature/manager-stop-gate` at `f752633` or later (unpublished), local-CLI install for Codex. Same scenario as [run 6](../2026-10-18-stop-gate-claude-rerun/log.md) on Claude Code.

Questions this run answers:

- [FEATURE] Checks 1–4 of run 6 on Codex: a mid-loop B request challenged with the on-hold command and the task `on-hold`; the loop continues and stops on F; every accepted stop report committed by the manager; six-heading English reports with German chat, a rebind and a final class A stop.
- [FEATURE] Check 5 (Codex-specific): roles chain through the Codex Stop hook (`turn-start` per role), and report capture through `last_assistant_message` records the saved English copy as the manager report.
- [SANDBOX] First headless `codex exec` loop run with `-s danger-full-access` (approved by the user for this run, D-7) and `gpt-5.6-sol`.

Layout:

- Sandbox (disposable): `<workspace>/sandbox-stop-gate-codex/`
- Heavy artifacts (local only): `<workspace>/sandbox-logs/2026-10-18-stop-gate-codex/artifacts/`
- Fixture: run 5's fixture repo (`95d0f6f`), cloned unchanged.
- Driver: `driver/run-session.sh` (Codex variant of run 6's), `driver/prompt-run1.txt`, `driver/prompt-run2.txt`, `driver/archive.sh`.

## Journal

### 1. Roll-out

- [SANDBOX] DECISION: the prompts are run 6's with two platform-specific changes only: `Plattform claude-code` → `Plattform codex`, and the skill copy path `.claude/skills/epic-loop` → `.codex/skills/epic-loop`.
- [SANDBOX] DECISION: launch `codex exec -C <sandbox> -m gpt-5.6-sol -s danger-full-access -c check_for_update_on_startup=false -c approval_policy=never -c <hooks.state> -c <projects> --json <prompt>`, `timeout 50m`, stdin from `/dev/null`; hook and project trust come from `tools/codex-trust-args.mjs` (never `~/.codex/config.toml`). `[features] hooks = true` goes into the sandbox's `.codex/config.toml`.
- [SANDBOX] OBSERVATION: pre-flight: `codex exec -m gpt-5.6-sol` answered a smoke prompt (18,689 tokens; the account default model works in exec now, unlike run 2). In a throwaway clone: install OK, `.codex/skills/epic-loop` identical to the branch source, `.codex/hooks.json` written, doctor `ready` with the project hooks feature enabled, trust args generated.

### 2. Checks without an agent

- [FEATURE] PASS: local-CLI install for Codex; `.codex/skills/epic-loop` identical to the branch source (`artifacts/run1/01-install.txt`); doctor `ready` with the project hooks feature on (`artifacts/run1/02-doctor.json`); trust args in `artifacts/run1/04-trust-args.txt`; the port holder listened on `*:4317`.

### 3. Headless agent session

#### Session 1 (`artifacts/run1/`): stopped by the Codex usage limit

- [SANDBOX] OBSERVATION: `driver/run-session.sh run1` ran 7.5 min (13:36:08–13:43:57 UTC), then `codex exec` exited 1 with `turn.failed`: "You've hit your usage limit … try again at Oct 19th, 2026 1:35 AM." The limit hit during engineer turn 17 (README task), before the loop reached any accepted stop. Token usage (rollout `total_token_usage`): 11,323,479 total, of which 11,140,736 cached input and 35,070 output. Per the brief, no retry; partial results below. The rollout is archived in `artifacts/run1/codex-rollout/`.
- [FEATURE] PASS (check 5, chaining): the roles chained through the Codex Stop hook, one `turn-start` per role: `1 manager, 2 techlead, 3 engineer, 4 techlead, 5 manager, 6 techlead, 7 engineer, 8 techlead, 9 engineer, 10 techlead, 11 engineer, 12 techlead, 13 manager, 14 techlead, 15 engineer, 16 techlead, 17 engineer`. Nothing ran inline in one turn (unlike run 2 with `gpt-5.6-luna`).
- [FEATURE] PASS (check 5, capture): `last_assistant_message` capture recorded 5 engineer reports and 3 manager reports; the manager report of the D challenge (turn 13) is the German chat line, as expected for a challenge (no saved copy).
- [FEATURE] PASS (check 1): after only the first task, the techlead filed `request-stop --class B` for the publish task ("blocks: only the npm registry publication task; export, date formatting, HTTP serving, README, and local verification remain independent"). The manager queued H1 and **challenged** (round 1) with `node .codex/skills/epic-loop/scripts/set-task-status.mjs --slug report-export --task-id phase-1-task-5 --status on-hold --hold-kind human-action --hold-item H1`, then "continue with the independent export-command task". The tracker shows `Status: on-hold` with `  - Hold: human-action (H1)`; no task was ever `blocked`.
- [FEATURE] PASS (new, D challenge): the techlead filed `request-stop --class D` for the busy fixed port ("occupied by a foreign Node.js listener (PID …); terminating it is outside scope"). The manager **challenged** with a concrete workaround: keep the production entrypoint on 4317, verify `createServer` through a real request on disposable port 0, checkpoint, set the serve task `partially-satisfied`, defer the fixed-port check to the Phase 1 verification task, continue with the README. The loop continued as instructed. First real-run evidence of the D challenge branch (Claude never filed D).
- [FEATURE] NOT REACHED: checks 2 (stop on F), 3 (manager commits each accepted stop report) and 4 (reports, rebind, class A): the usage limit hit first. Session 2 was not started.
- [FEATURE] FINDING (Codex, agent-made decisions): the Codex techlead wrote its default decisions into `decision-log.md` by hand (`### D1 - …` with "Status: active, agent-made under …"), not with `agent-decision.mjs add`. `agent-decision.mjs list` and `role-summary` therefore show no agent-made decisions, so a stop report would not list them for confirmation. Claude used the script (runs 5 and 6). Prompt finding, not tuned in this pass.
- [FEATURE] OBSERVATION: the techlead also recorded the product owner's "no npm publish" constraint as a decision (D2), and filed B before doing any independent work (Claude did the independent work first). Both are valid under D16.
- [SANDBOX] OBSERVATION: at the cutoff the sandbox had 4 task commits and uncommitted epic artifacts plus `README.md` from the interrupted engineer turn; the archive keeps them (`artifacts/90-archive/uncommitted.diff`, `git-status.txt`).

### 4. Fixes

- [FEATURE] None: no Codex-specific product bug appeared before the cutoff.

### 5. Archive and cleanup

- [SANDBOX] PASS: `driver/archive.sh`: bundle verified and restore-tested (4/4 tests), `.epic-loop/` with `.runtime/` and the sandbox `.codex/` config (hooks.json, config.toml; skill copy omitted) in `artifacts/90-archive/`; sandbox removed. The port holder was killed.
- [SANDBOX] OBSERVATION: inventory: no leftover processes (one `loop-watch.mjs` survived `TaskStop` and was killed by pid), port 4317 free, no entry for the sandbox path in `~/.codex/config.toml` (trust was inline) or `~/.claude.json`. Kept on purpose: the two Codex rollouts of this run in `~/.codex/sessions/2026/10/18/` (the smoke test and session 1); they are the user's Codex history and a copy of session 1 is archived. Local artifacts: 2.9 MB.

## Summary

### [FEATURE]

- PARTIAL, stopped by the Codex usage limit after 7.5 min and 17 turns. Passed before the cutoff: check 1 (B challenged mid-loop with the exact on-hold command, task `on-hold` with `Hold: human-action (H1)`), check 5 (roles chained through the Codex Stop hook; `last_assistant_message` capture), and a first real-run D challenge with a concrete workaround. Not reached: checks 2–4 (the F stop, manager-committed stop reports, the rebind and class A).
- FINDING: on Codex, agent-made decisions were hand-written into `decision-log.md` instead of `agent-decision.mjs add`, so they are invisible to `agent-decision list`, `role-summary` and the stop report.
- To finish: rerun this driver unchanged after the limit resets (Oct 19, 2026 01:35 local, per the error).

### [SANDBOX]

- Headless `codex exec` with `gpt-5.6-sol`, inline trust and `-s danger-full-access` ran the loop through project hooks with no dialog, no global config edits and no workaround.
- The quota estimate was wrong despite the user's check: one loop session used 11.3 M tokens (98% cached input). LEARNINGS "Host limits" now records the size of a Codex loop session.
