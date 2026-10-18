# Sandbox run: stop-gate role mechanics on Codex, minimal (2026-10-18)

Run 8 of the `sandbox-test` skill. Target: branch `feature/manager-stop-gate` at `a5a7af0`, local-CLI install for Codex. Replaces the unfinished part of [run 7](../2026-10-18-stop-gate-codex/log.md), which spent the whole Codex quota on the full 9-task scenario (decision D33 of the visual-review epic).

Questions this run answers:

- [FEATURE] On Codex, do the roles chain through the Stop hook; does a B request with independent work left get challenged with the on-hold command; does the loop then finish the independent work, and does a final B request get accepted with a saved stop report that the manager commits?
- [SANDBOX] Can a Codex loop run stay small: 3 tasks, one session, low reasoning effort, no user config, a turn watchdog?

Layout:

- Sandbox (disposable): `<workspace>/sandbox-stop-gate-codex-mini/`
- Heavy artifacts (local only): `<workspace>/sandbox-logs/2026-10-18-stop-gate-codex-mini/artifacts/`
- Fixture (local only): `<workspace>/sandbox-logs/2026-10-18-stop-gate-codex-mini/fixture/` (`39a02da` project, `84c0e71` epic `mini`: publish to npm, `version()`, verification)
- Driver: `driver/run-session.sh`, `driver/prompt.txt`, `driver/archive.sh`

## Journal

### 1. Roll-out

- [SANDBOX] DECISION: one session; `codex exec --ignore-user-config` (no user `config.toml`, so no MCP servers and no `reasoning high`; auth still from `CODEX_HOME`), `-m gpt-5.6-sol -c model_reasoning_effort=low`, `-s danger-full-access` (approved by the user, D-7), inline trust, `timeout 15m`, and a watchdog that kills the session after 14 role turns. English prompt; the language rule was already verified on Claude Code.
- [SANDBOX] OBSERVATION: dry run (`DRY_RUN=1`): install OK, skill copy identical to the branch source, doctor `ready`.

### 2. Headless agent session

- [SANDBOX] OBSERVATION: 6.2 min (14:48:14–14:54:28 UTC), exit 0, 11 role turns, watchdog not triggered. Usage: 3,865,961 input tokens (3,773,824 cached), 14,222 output, 3,145 reasoning. About a third of run 7, which also used 17 turns.
- [FEATURE] PASS (chaining): `turn-start` per role through the Codex Stop hook: `1 manager, 2 techlead, 3 manager, 4 techlead, 5 engineer, 6 techlead, 7 engineer, 8 techlead, 9 manager, 10 techlead, 11 manager`.
- [FEATURE] PASS (B challenged): on its first turn the techlead filed `request-stop --class B` for the publish task while two tasks were independent. The manager queued H1 and challenged (round 1) with the `set-task-status … --status on-hold --hold-kind human-action --hold-item H1` command. The tracker shows `Status: on-hold` with `  - Hold: human-action (H1)`.
- [FEATURE] PASS (continue, then accept): the engineer built `version()` (`eece570`) and the verification ran (`bffca12`, tests 2/2). A manager housekeeping turn (9) followed, then the techlead filed B again because nothing independent was left; the manager accepted it (round 1), saved `stop-reports/01-2026-10-18-class-B.md` (six headings) and committed it as `fd99a2b docs(epic): stop report 01 (class B)`. The saved English copy is the manager report.
- [FEATURE] OBSERVATION: no class C default came up, so `agent-decision.mjs list` stayed empty as expected; the agent-decision prompt fix (`401f6ea`) was not exercised on Codex.
- [FEATURE] FINDING (minor): after the stop, `implementation-log.md` (the techlead's closure note with the task commit hash) and `state-of-epic.md` were modified but not committed. They were written after the last task commit, and the D32 commit covers only the report, the queue and the decision log.
- [SANDBOX] OBSERVATION: `tools/loop-watch.mjs` showed both `stop-gate` events live in the Monitor.

### 3. Archive and cleanup

- [SANDBOX] PASS: `driver/archive.sh`: bundle verified and restore-tested (2/2 tests), `.epic-loop/` with `.runtime/` and the `.codex/` config archived, Codex rollout copied to `artifacts/codex-rollout/`; sandbox removed. No processes left, no entry in `~/.codex/config.toml`. Local artifacts: 2.3 MB.
- [SANDBOX] INCIDENT: a cleanup `for p in $(pgrep -f "<pattern>")` matched the calling shell and killed it (exit 144), exactly as "Process cleanup (run 4)" warns. Nothing was lost (the archive had finished). Use `ps -eo pid,args | grep "[p]attern"` instead.

## Summary

### [FEATURE]

- PASS: the stop-gate role mechanics work on Codex end to end in one small session: Stop-hook chaining, a B challenge with the on-hold command and an `on-hold` task, completion of the independent work, an accepted B stop with a six-heading English report that the manager committed.
- Not covered on Codex (covered on Claude Code in runs 5–6): the F stop, the rebind and a class A stop, the German chat. Minor finding: the techlead's last closure notes stay uncommitted after a stop.

### [SANDBOX]

- A Codex mechanics check can be kept small: 3 tasks, one session, `--ignore-user-config`, low reasoning effort and a turn watchdog cost a third of the full scenario. A Codex session still re-sends its whole context on every tool call, so turns, not tasks, drive the cost.
