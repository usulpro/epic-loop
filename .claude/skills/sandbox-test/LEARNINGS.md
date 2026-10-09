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
| [2026-10-09-bg-task-interrupt](runs/2026-10-09-bg-task-interrupt/log.md) | Issue #4 on published `epic-loop@0.2.1` (headless repro), then the new user-prompt contract on Claude Code and Codex (interactive) | Bug reproduced and fixed; contract changed and verified on both hosts; 1 incident (Codex self-update via blind typing), several workarounds |

## Decisions

- **D-1 (2026-10-09, run 1). Layout.** The sandbox lives at `<workspace>/sandbox-<topic>/` with its own `git init` and local git identity. Heavy artifacts stay local in `<workspace>/sandbox-logs/<run>/artifacts/`. Only the text run log and the prompt are committed, in `runs/`. Why: logs must outlive cleanup, and the repo should not carry MBs of transcripts.
- **D-2 (2026-10-09, run 1). Install like a user.** Use the published artifact (`npx pkg@version`) with dev overrides (`EPIC_LOOP_CLI`, `EPIC_LOOP_SKILL_DIR`) unset. Why: the run must exercise what users get, not the dev path.
- **D-3 (2026-10-09, run 1). Real agent, scoped permissions.** Drive behavior that involves hooks or the loop with `claude -p`, `--permission-mode acceptEdits`, and a narrow `--allowedTools` list, plus budget and timeout guards. Never `--dangerously-skip-permissions`. Why: only a real session exercises hooks, binding, and continuation. The host's auto-mode blocks skip-permissions anyway, and a scoped list shows which commands the product really needs.
- **D-4 (2026-10-09, run 1). Fix in the source repo, verify in the sandbox.** Bugs found in the sandbox get fixed in this repo with a regression test, then re-checked in a fresh sandbox scenario. Use the local CLI if the fix isn't published yet. Fixes are committed locally; push and release need the user.
- **D-5 (2026-10-09, run 1). Archive before cleanup.** Make a git bundle (restore-tested) and copy the epic state and host transcript before deleting. Cleanup covers the sandbox dir and `~/.claude/projects/<sandbox-path>`. The npx cache is kept on purpose because it is shared with real use.

- **D-6 (2026-10-09, run 2). Interactive runs go through a pty driver with gates.** Behavior that needs a real TUI (Esc, typing while the agent works) is driven with `tools/ptydrive.py`. Every run starts with a `forbid` step (updater, trust, and hook-review dialogs), never types before an `expect` sees the input composer, and gates each scenario step on the product's own trace (`expect_file` on `progress-log.jsonl`), not on sleeps. Claude runs use `--permission-mode dontAsk` with the allowlist (a permission dialog would hang the pty) and `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1` (nested sessions otherwise keep no transcript). Why: run 2's blind typing chose "Update now" in Codex's updater and modified the user's global install.
- **D-7 (2026-10-09, run 2). Codex sandbox flags.** Pre-trust hooks and the project for one run with inline `-c` tables from `tools/codex-trust-args.mjs` (never edit `~/.codex/config.toml`). Add `[features] hooks = true` to the sandbox's `.codex/config.toml` for doctor. Use `-c check_for_update_on_startup=false`, the user's default model (`gpt-5.6-sol`), and, with the user's explicit approval per run, `-s danger-full-access -a never`, because `workspace-write` keeps `.git` read-only and loop commits fail. Why: run 2 attempts 1–2.
- **D-8 (2026-10-09, run 2). Reusable tooling lives in the skill.** Drivers and helper scripts go in `tools/` and are committed; the scratchpad and `sandbox-logs` are not durable (a host restart cleared part of the scratchpad mid-run).

## Working

| Practice | Confirmed | Runs |
| --- | --- | --- |
| Tiny fixture (one module plus one `node --test` test) keeps the epic about mechanics; a full epic ran in about 4 min / $2.66 | 2 | run 1, run 2 |
| Pre-answered prompt with explicit approvals lets a session go through shaping, binding, and the whole loop without questions (headless and interactive, Claude and Codex) | 2 | run 1, run 2 |
| `progress-log.jsonl` plus the host transcript are enough to reconstruct the role chain and every hook continuation; hook captures (`.epic-loop/.runtime/hook-events`, with `prompt` / `last_assistant_message`) cover what the agent said when no transcript exists | 2 | run 1, run 2 |
| Copying a real old install (e.g. from another local project) into the sandbox is a cheap, realistic migration test | 1 | run 1 |
| Git bundle plus a restore test (clone, run tests) proves the archive is usable before deleting | 2 | run 1, run 2 |
| A minimal probe sandbox with payload-logging hooks answers harness questions (what fires on Esc, steer, notifications) before designing a fix | 1 | run 2 |
| A parallel research subagent for the other host (source + real rollouts + tiny exec runs) gives facts the run then confirms | 1 | run 2 |

## Needs tuning

- **Permission allowlist friction (run 1, run 2).** Run 1 had 5 denials, all from compound shell commands (`cmd; echo $?`, `| head`, `cd … && git …`). The agent recovered by splitting them. Run 2 added `Bash(cat:*)`, `Bash(head:*)`, `Bash(wc:*)` and still got 5 compound-command denials, plus a `Monitor` denial. Widening single-command prefixes does not help. Lean towards accepting the friction as a signal; add `Monitor` to the allowlist.
- **Host leakage (run 1; partly solved run 2).** Run 1's sandbox session loaded the user's global Stop hook (`gk ai hook run`, GitKraken) and every user-level skill and plugin. In run 2, `--setting-sources project` kept user hooks out and auth worked. Codex still loads user MCP servers (Sanity login warnings). Make `--setting-sources project` the default once confirmed again.
- **stream-json is misleading for hooks (run 1).** Stop-hook continuations show up only as a "Stop hook error occurred" notification. That is how Claude Code represents `decision: block`. Procedure step 4 already redirects to the right sources; a small transcript-summary script may be worth adding.
- **Host env leaking into tests (run 1).** Unit tests inherited `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` from the shell. Fixed for `cli-package.test.mjs`; check other test files when a sandbox fix touches them.

- **Global side effects of driven TUIs (run 2).** Interactive host CLIs can act on the machine outside the sandbox (Codex self-update via its updater dialog; `~/.claude.json` trust entries per sandbox path). `forbid` and update-off flags reduce this; trust entries are still left behind (not removed while Claude Code is running).
- **Host limits and restarts (run 2).** A Codex run hit the user's ChatGPT usage limit mid-scenario (API-error turns fire no `Stop`), and the host Claude Code restarted and killed a background driver. Check quota before long Codex runs, and record partial results instead of retrying blindly.
- **Driver gate markers (run 2).** A loop the techlead ends logs `skip … "status":"idle"`, not `no-continuation-role`. Gate on `"status":"idle"`.

## Open questions

- Run 2 reused run 1's fixture and prompt nearly verbatim. Move them into `templates/` (fixture files + base prompt with platform/slug placeholders) on the next run that needs them.
- Codex as the driving host: answered in run 2. `codex exec` runs project hooks and continues on Stop `block` (same `turn_id`, no block cap); the interactive TUI is driven through `ptydrive.py`.
- How should autoupdate be tested through real npm? It needs an older wrapper-capable version than `latest` (possible from 0.2.1 on).
