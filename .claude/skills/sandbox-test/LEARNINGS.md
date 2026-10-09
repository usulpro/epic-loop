# Sandbox test: learnings

Experience accumulated across runs of the `sandbox-test` skill. It covers the **sandbox method** only. Product findings live in each run log and in the product's own epics, issues, and commits.

How to maintain it after each run:

- Practice worked again: bump its `Confirmed` count and add the run id.
- Practice failed or needed a workaround: move it to "Needs tuning" with what happened and the run id. Don't delete history.
- New decision: add it under "Decisions" with date, run id, and rationale.
- New open question: add it under "Open questions".

## Consolidation criteria

Fold this file back into `SKILL.md` and remove the "experimental" banner when all of the following hold:

- at least 5 runs are logged, covering at least 2 kinds of target (e.g. a feature branch before release, a published version, a migration or upgrade path);
- every practice in "Working" has `Confirmed` ≥ 3, and "Needs tuning" is empty or only lists accepted limitations;
- the last 2 runs needed no new workaround.

When consolidating, keep `runs/` (or a summary of it) as history and reset this file to the post-consolidation open questions.

## Runs

| Run | Target | Outcome |
| --- | --- | --- |
| [2026-10-09-npx-0.2.0](runs/2026-10-09-npx-0.2.0/log.md) | `feature/distribution-foundation` + published `epic-loop@0.2.0`: npm path, full epic, legacy upgrade | Feature verified; 1 bug fixed (`d8c2485`); method worked after 1 workaround |

## Decisions

- **D-1 (2026-10-09, run 1). Layout.** The sandbox lives at `<workspace>/sandbox-<topic>/` with its own `git init` and local git identity. Heavy artifacts stay local in `<workspace>/sandbox-logs/<run>/artifacts/`. Only the text run log and the prompt are committed, in `runs/`. Why: logs must outlive cleanup, and the repo should not carry MBs of transcripts.
- **D-2 (2026-10-09, run 1). Install like a user.** Use the published artifact (`npx pkg@version`) with dev overrides (`EPIC_LOOP_CLI`, `EPIC_LOOP_SKILL_DIR`) unset. Why: the run must exercise what users get, not the dev path.
- **D-3 (2026-10-09, run 1). Real agent, scoped permissions.** Drive behavior that involves hooks or the loop with `claude -p`, `--permission-mode acceptEdits`, and a narrow `--allowedTools` list, plus budget and timeout guards. Never `--dangerously-skip-permissions`. Why: only a real session exercises hooks, binding, and continuation. The host's auto-mode blocks skip-permissions anyway, and a scoped list shows which commands the product really needs.
- **D-4 (2026-10-09, run 1). Fix in the source repo, verify in the sandbox.** Bugs found in the sandbox get fixed in this repo with a regression test, then re-checked in a fresh sandbox scenario. Use the local CLI if the fix isn't published yet. Fixes are committed locally; push and release need the user.
- **D-5 (2026-10-09, run 1). Archive before cleanup.** Make a git bundle (restore-tested) and copy the epic state and host transcript before deleting. Cleanup covers the sandbox dir and `~/.claude/projects/<sandbox-path>`. The npx cache is kept on purpose because it is shared with real use.

## Working

| Practice | Confirmed | Runs |
| --- | --- | --- |
| Tiny fixture (one module plus one `node --test` test) keeps the epic about mechanics; a full epic ran in about 4 min / $2.66 | 1 | run 1 |
| Pre-answered prompt with explicit approvals lets a headless session go through shaping, binding, and the whole loop without questions | 1 | run 1 |
| `progress-log.jsonl` plus the host transcript are enough to reconstruct the role chain and every hook continuation | 1 | run 1 |
| Copying a real old install (e.g. from another local project) into the sandbox is a cheap, realistic migration test | 1 | run 1 |
| Git bundle plus a restore test (clone, run tests) proves the archive is usable before deleting | 1 | run 1 |

## Needs tuning

- **Permission allowlist friction (run 1).** 5 denials, all from compound shell commands (`cmd; echo $?`, `| head`, `cd … && git …`). The agent recovered by splitting them. Options: add `Bash(head:*)`, `Bash(wc:*)`, `Bash(cat:*)`, or accept the friction as a signal. Decide after another run.
- **Host leakage (run 1).** The sandbox session loaded the user's global Stop hook (`gk ai hook run`, GitKraken) and every user-level skill and plugin. Harmless here, but the run is not hermetic. Try `--setting-sources project` or a throwaway `CLAUDE_CONFIG_DIR` next run, and check that auth still works.
- **stream-json is misleading for hooks (run 1).** Stop-hook continuations show up only as a "Stop hook error occurred" notification. That is how Claude Code represents `decision: block`. Procedure step 4 already redirects to the right sources; a small transcript-summary script may be worth adding.
- **Host env leaking into tests (run 1).** Unit tests inherited `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` from the shell. Fixed for `cli-package.test.mjs`; check other test files when a sandbox fix touches them.

## Open questions

- Should the sandbox fixture and prompt templates live in this skill (`templates/`) once a second run reuses them?
- Codex as the driving host: is there an equivalent headless mode with Stop-hook continuation? Untested.
- How should autoupdate be tested through real npm? It needs an older wrapper-capable version than `latest` (possible from 0.2.1 on).
