# Sandbox run: issue #4, background task kills the loop (2026-10-09)

Run 2 of the `sandbox-test` skill.

Questions this run answers:

- [FEATURE] In a real Claude Code session on published `epic-loop@0.2.1`, does a `run_in_background` Bash task completing during an open loop turn fire `UserPromptSubmit` with a `<task-notification>` prompt?
- [FEATURE] Does `markInterruptedTurnIfNeeded()` then record `turn-interrupted` (`user-prompt-interrupted-open-turn`), set `status: interrupted` / `next_role: idle`, and does the next `Stop` skip with `loop-not-running`, leaving the epic unfinished?
- [FEATURE] Is the stop visible in human-facing artifacts (`state-of-epic.md`, `tracker.md`, `implementation-log.md`)?
- [FEATURE] Added mid-run (user decision, see 4b): does the new contract hold identically on Claude Code and Codex, in interactive sessions? Under it, a user message never stops the loop, Esc aborts and resumes the role, and only an explicit request stops the loop.
- [SANDBOX] Try `--setting-sources project` to stop user-level hooks/skills leaking in (open item from run 1). Try a slightly wider allowlist (`cat`, `head`, `wc`) against compound-command friction.

Layout:

- Sandboxes (disposable, all removed): `sandbox-bg-task-interrupt` (repro), `-fix` (narrow fix), `sandbox-probe-claude-interrupt` (Esc/steer probe), `sandbox-user-prompt-claude`, `sandbox-user-prompt-codex{,2,3}`, all under `/projects/my-projects/epic-loop-workspace/`.
- Heavy artifacts (local only, not in git): `/projects/my-projects/epic-loop-workspace/sandbox-logs/2026-10-09-bg-task-interrupt/artifacts/`

## Journal

### 1. Roll-out

- [SANDBOX] DECISION: same tiny fixture as run 1 (`src/stats.mjs` with `sum` + one `node --test` test), plus `scripts/slow-check.mjs`, a 20 s no-op that prints `slow-check: OK`. It stands in for the dev server / long build from the issue and gives the agent a legitimate reason to use `run_in_background`.
- [FEATURE] PASS: `npx --yes epic-loop@0.2.1 install --platform claude-code` (dev overrides and block cap unset) installed skill 0.2.1 and all 3 hooks. The doctor "Next:" line now asks only for `export CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0` (run 1 fix shipped in 0.2.1). `artifacts/01-install.txt`.

### 2. Checks without an agent

- [FEATURE] PASS: doctor through the skill wrapper with `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0`: `ready`, `skill.source=env`, 0.2.1 = latest. `artifacts/02-doctor-wrapper.json`.

### 3. Headless agent session

- [SANDBOX] DECISION: the prompt (`session-prompt.txt`) is run 1's prompt plus a user-mandated "verification protocol": after each task the engineer starts `node scripts/slow-check.mjs` with `run_in_background: true`, keeps working, then reads the output. This makes the hazard deterministic instead of hoping the agent picks a background task.
- [SANDBOX] DECISION: launched with `--setting-sources project` (LEARNINGS open item "host leakage") and the allowlist widened by `Bash(cat:*)`, `Bash(head:*)`, `Bash(wc:*)`.
- [SANDBOX] PASS: auth still works with `--setting-sources project`. The user's global GitKraken Stop hook did not run: the transcript `stop_hook_summary` shows only the epic-loop hook.
- [FEATURE] FAIL, reproduced on the first try (session `fb6943fa…`, 45 turns, about 2 min, $1.34). From `progress-log.jsonl`:
  - `04:53:23` `loop-start`; manager (iter 1), then techlead (iter 2) sets `next_role: engineer`.
  - `04:53:59` `turn-start` engineer, iter 3 (task: mean).
  - `04:54:07` engineer starts `slow-check.mjs` with `run_in_background: true` (task `bwstrfpgy`), then runs `npm test` and a `Monitor` on the output file (task `ba9rhujkq`), then a foreground `node -e` poller that blocks for about 40 s.
  - `04:54:27-28` both tasks finish. Claude Code queues their `<task-notification>` blocks as `queued_command` attachments while the poller is still running.
  - `04:55:07` the poller returns. The queued notifications are drained mid-turn and `UserPromptSubmit` fires. `markInterruptedTurnIfNeeded()` logs `turn-interrupted`, `reason: user-prompt-interrupted-open-turn`, `role: engineer`.
  - `04:55:13` the engineer finishes its report. `Stop` gives `skip`, `reason: loop-not-running`, `status: interrupted`. The session ends with exit 0, no error.
- [FEATURE] FINDING, the payload. `UserPromptSubmit` keys are `session_id, transcript_path, cwd, scratchpad_dir, prompt_id, permission_mode, hook_event_name, prompt`; there is no `turn_id`. `prompt` is exactly one bare `<task-notification>…</task-notification>` block: no `<system-reminder>` wrapper, no "[SYSTEM NOTIFICATION …]" banner, and no human text. The banner the model sees is added on the model side, not in the hook payload, so a fix must not depend on it. Captured: `.epic-loop/.runtime/hook-events/<session>/20261009T045507Z-userpromptsubmit-no-turn.json`.
- [FEATURE] FINDING, a lost report. The engineer finished the task correctly (`mean` plus 3 tests, `npm test` 4/4, `slow-check: OK`), but `last_engineer_report_at` is `null`. The Stop that should have captured the report was skipped, so the work sits uncommitted in the tree and no role ever reviews it.
- [FEATURE] FINDING, a silent stop. `runtime-state.json` has `status: interrupted`, `next_role: idle`. But `state-of-epic.md` still says "Active task: Phase 1 Task 1"; `tracker.md` shows task 1 `doing` and the other two `todo`; `implementation-log.md` ends at "Bind session and start implementation loop". Nothing human-facing shows that the loop stopped.
- [FEATURE] OBSERVATION: two notifications were queued (`bwstrfpgy`, `ba9rhujkq`), but only one `UserPromptSubmit` capture exists. Hook-event filenames have one-second precision (`20261009T045507Z-userpromptsubmit-…`), so two events in the same second may overwrite each other. Not confirmed; it does not affect the bug, because the first one already interrupts.
- [FEATURE] OBSERVATION: the hazard does not need the engineer to "misbehave". The model used `run_in_background` plus the `Monitor` tool on its own initiative to wait for the output. Both are normal Claude Code patterns.
- [SANDBOX] OBSERVATION: 6 permission denials. 5 were compound/`cd …&&` Bash commands, as in run 1. One of the two `Monitor` calls was also denied. The other one ran and registered background task `ba9rhujkq`, whose notification is the one captured. So the allowlist does not fully cover Monitor. Widening by `cat`/`head`/`wc` did not reduce the compound-command friction.

- [FEATURE] FINDING, against the issue: a resume path does exist. Agent-free check on the interrupted sandbox: `bind-session.mjs --session-id <driver> --slug stats-helpers --mode implementation` set `status: running`, `next_role: manager`, `last_reason: implementation-start` and logged `loop-start` (`artifacts/08-rebind.txt`). `bindSession()` always calls `startImplementationLoop()`; nothing short-circuits an already-bound session. Issue proposal 3 (`resume-loop.mjs`) is therefore not needed. What was missing is documentation; the fix adds it.

### 4. Fixes

- [FEATURE] FIX (branch `fix/bg-task-notification-interrupt`):
  - `isSyntheticUserPrompt()` in `scripts/lib/loop.mjs`: a prompt that is empty after stripping `<task-notification>` and `<system-reminder>` blocks is synthetic. A missing prompt and any prompt with other text are still user input. This keeps the existing Codex/no-prompt contract and the mixed "notification + human text" case.
  - `markInterruptedTurnIfNeeded()` ignores synthetic prompts on an open turn and logs `synthetic-prompt-ignored` to `progress-log.jsonl`, so the decision stays auditable.
  - `buildModeReminder()` no longer injects mode markers into synthetic prompts.
  - Docs: `SKILL.md`, `references/implementation-cycle.md`, `references/hooks-and-session-routing.md` describe the synthetic-prompt rule and that rebinding with `--mode implementation` restarts the loop.
- [FEATURE] Regression test `tests/unit/hook-interrupt-contracts.test.mjs`. It uses the captured payload shape (single, double, and `system-reminder`-prefixed notifications): no interrupt, `synthetic-prompt-ignored` logged, the next `Stop` captures the engineer report and blocks into techlead; notification + human text still interrupts. Red on the pre-fix code (`interrupted` ≠ `running`), green after. `pnpm run test:unit` 103/103, `pnpm run validate` OK.
- [SANDBOX] WORKAROUND: the new test pushed `hook-contracts.test.mjs` over oxlint `max-lines` (900). Moved both interrupt tests into `hook-interrupt-contracts.test.mjs` and the shared `writeSessionBinding` / `writeOpenImplementationTurn` helpers into `test-utils.mjs`.
- [SANDBOX] DECISION: re-verify in a fresh sandbox (`sandbox-bg-task-interrupt-fix`, cloned from the fixture commit) installed with the local CLI from source (`node packages/cli/src/cli.mjs install`). When run from `src/`, it copies the skill straight from `plugins/` (`bundledSkillDir()`), so the hook scripts carry the fix while the version stays 0.2.1. Same prompt, flags, and allowlist as the repro session.

- [FEATURE] PASS, fix re-verified (session `a3625836…`, local-CLI install, same prompt/flags): `synthetic-prompt-ignored` fired in all 3 engineer turns, the loop chained through 12 iterations to `idle`, 3 task commits (`0f37690`, `dc3f161`, `62edd4c`), about 5 min, $2.66. Each engineer turn was correctly closed by its own `Stop`.

### 4b. Contract change: a user message never stops the loop

- [FEATURE] DECISION (user, 2026-10-09): the narrow fix is not enough. Why the loop stopped on any user prompt was undocumented. It came in `4e8f934` "fix: statuses" (Codex era) for turn accounting and to keep the loop from taking a conversational reply for a role report. New contract: a question gets an answer and the loop keeps going; only an explicit stop request stops it. Applies to both Claude Code and Codex.
- [FEATURE] FINDING, Claude Code facts from an interactive pty probe (`sandbox-probe-claude-interrupt`, hooks that only log payloads):
  - Esc on a running turn fires **no** `Stop`.
  - The next prompt gets a **new** `prompt_id`.
  - A message typed while the agent works fires `UserPromptSubmit` with the **same** `prompt_id` as the running turn; the turn continues and its final reply answers it.
  - From sandbox runs 1–2: the whole Stop-hook role chain and every mid-turn `<task-notification>` share the first prompt's `prompt_id`.
  - There is no hook event for Esc (2.1.293 hook table: no interrupt event; `StopFailure` covers API errors only).
  - New `Stop` payload fields: `background_tasks`, `session_crons`.
- [FEATURE] FINDING, Codex 0.145.0 facts (subagent research: source at `rust-v0.145.0`, real TUI rollouts, two `codex exec` runs). The behavior is symmetric with Claude Code, keyed by `turn_id`:
  - Stop-hook continuations stay in the same `turn_id`.
  - A steer (Enter while running) fires `UserPromptSubmit` with the same `turn_id`.
  - Esc fires no `Stop`; the next prompt has a new `turn_id`. The rollout records `turn_aborted`, but the payload carries no abort flag.
  - Codex has no Stop-block cap.
  - Goal and mailbox turns start without `UserPromptSubmit`.
  - `additionalContext` on `UserPromptSubmit` is supported.
- [FEATURE] DESIGN: the loop records `turn_key` (`prompt_id ?? turn_id`) on each continuation. A driver `UserPromptSubmit` is then classified:
  - synthetic: ignored;
  - same `turn_key`: `user-message-in-turn` plus context "answer briefly, finish the role turn";
  - new `turn_key` with an open turn: `turn-aborted`. No report is taken, the same role resumes on the next `Stop` with a "Resuming the <role> turn" note, and the context says "answer; the loop resumes";
  - stop: the agent runs the new `stop-loop.mjs` on any-language intent, and the exact `stop loop mode` is handled in the hook. Both log `loop-stopped` and set `interrupted`/`idle`;
  - stopped: the context tells the agent how to resume (`bind-session.mjs --mode implementation`).
  - An unknown turn identity is treated as aborted, which is the safe side.
- [FEATURE] The new logic lives in `scripts/lib/loop-user-prompt.mjs`, because `loop.mjs` is at the oxlint 600-line limit.
  - Changed tests: `hook-interrupt-contracts.test.mjs` was rewritten (8 cases, including a Codex `turn_id` variant). Two older tests asserted "the driver gets no reminder", a mode-reminder decision whose rationale ("continuations already carry role context") does not cover human prompts; both were updated to the new guidance.
  - Docs: `SKILL.md`, `implementation-cycle.md`, `hooks-and-session-routing.md`.
  - `pnpm run test:unit` 109/109, `pnpm run validate` OK.
- [FEATURE] FINDING (separate bug, not fixed here): the Codex doctor reports `setup-required` / "hooks feature: unknown" unless `[features] hooks = true` is set. The research shows hooks are stable and on by default in Codex 0.145.0, so the check is stale.
- [SANDBOX] DECISION: Esc needs an interactive TUI and tmux is not installed, so I wrote a small Python pty driver (`artifacts/tools/ptydrive.py`). Steps are `wait` / `send` / `key` / `expect` (screen regex) / `expect_file` (wait for a regex in a file). Gating on `progress-log.jsonl` makes the scenario follow the loop instead of fixed sleeps.
- [SANDBOX] DECISION: interactive runs use `--permission-mode dontAsk` with the same allowlist. A permission dialog would hang the pty; `dontAsk` denies instead of asking.
- [SANDBOX] LESSON: the Claude trust dialog defaults to "No, exit". The driver must press Down, then Enter.
- [SANDBOX] LESSON: Claude Code blocks a standalone `sleep N` as a harness rule; use `node -e "setTimeout(…)"` for long foreground commands.
- [SANDBOX] LESSON: nested Claude sessions inherit `CLAUDE_CODE_CHILD_SESSION`, and the TUI warns "Transcript saving is off". That is why the probe left no transcript. Set `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1` for nested interactive runs. The headless runs did write transcripts.
- [SANDBOX] DECISION, Codex sandbox without touching `~/.codex/config.toml`:
  - Hook trust and project trust go in as inline `-c` tables (`hooks.state={…}`, `projects={…}`); hashes come from `artifacts/tools/hash.mjs` / `mkargs.mjs`, which reproduce real `trusted_hash` values.
  - `.codex/config.toml` gets `[features] hooks = true` for doctor.
  - Run flags: `-s workspace-write -a never`, network on, `~/.npm` writable, `-m gpt-5.6-luna`. The configured default model is rejected for this account in exec.

### 4c. Interactive verification of the new contract

- [FEATURE] PASS, Claude Code interactive (`sandbox-user-prompt-claude`, opus, local-CLI install, `dontAsk` + allowlist; same prompt as before with slug pinned; scenario in `artifacts/22-claude-steps.json`). From `progress-log.jsonl` and hook captures:
  - Steer during engineer iter 3 ("which file are you changing?", same `prompt_id`): logged `user-message-in-turn`. The engineer answered inside its report and the loop continued to techlead.
  - Esc during engineer iter 5, then "what were you doing just now?" (new `prompt_id`): `turn-aborted` at 05:35:15. The agent answered in one sentence, and the next `Stop` started engineer iter 6 with "Resuming the engineer turn that the user interrupted." The one-line answer was not taken as the engineer report; iter 6 produced the real report.
  - "остановись, пожалуйста — хочу посмотреть, что получилось", typed during techlead iter 7 (same `prompt_id`): the model ran `stop-loop.mjs` itself, logging `turn-interrupted` / `loop-stopped` with reason `user-requested-stop`. It summarized progress in Russian, and the next `Stop` was `skip loop-not-running`.
  - "ок, продолжай цикл": the model rebound (`loop-start` 05:36:33). Manager, techlead, and engineer (verification) ran, then phase closure and end housekeeping, then `idle`. 3 task commits (`d0bc395`, `3636aa8`, `760ce9d`).
  - Background-task notifications in every engineer turn: `synthetic-prompt-ignored` 9×. One also landed in a techlead turn.
- [SANDBOX] LESSON: the driver's last gate waited for `no-continuation-role`, but a loop that the techlead ends with `set-next-role idle` logs `skip … loop-not-running … idle`. It timed out after 25 min with nothing wrong. Gate on `"status":"idle"` next time.

- [SANDBOX] INCIDENT (Codex attempt 1): Codex 0.145 opened an "Update available" dialog at startup. The driver typed the prompt blindly, a keystroke chose "1. Update now", and Codex ran `npm install -g @openai/codex`. That installed `@openai/codex@0.162.0` into Volta's Node image prefix (`~/.volta/tools/image/node/24.18.0`), which is a global side effect outside the sandbox. The Volta-managed `codex` stayed 0.145. The driver was stopped. My cleanup (`rm` of the stray package) was blocked by the auto-mode classifier and handed to the user, who then updated Codex through Volta to 0.162.0. LESSONS, now mandatory:
  - Never type into a TUI before an `expect` confirms the input composer is on screen.
  - Every driven TUI run starts with a `forbid` step (new driver feature) for updater, trust, and hook-review dialogs, which kills the child instead of typing into them.
  - Codex runs get `-c check_for_update_on_startup=false`.
  - Never use a broad `pkill -f <pattern>`: it matched the calling shell itself (exit 144).
- [SANDBOX] Codex 0.162.0 re-check before the retry:
  - The keys `check_for_update_on_startup`, `bypass_hook_trust`, and `trusted_hash` are present in the binary.
  - The TUI smoke start is clean (no dialogs, composer ready).
  - A `codex exec` with the inline `-c` pre-trust ran SessionStart, UserPromptSubmit, and Stop project hooks, so the trust hash format is unchanged.
  - Codex warns "ignoring 1 unrecognized configuration setting" (not identified; harmless here).

- [FEATURE] INCONCLUSIVE, Codex attempt 2 (0.162.0, `gpt-5.6-luna`, `-s workspace-write`). The loop never went through the Stop hook: `progress-log.jsonl` has `loop-start` and `role-command` entries but no `turn-start`. After binding, the model played manager → techlead → engineer inline in the first turn by calling `set-next-role` itself. Then commits failed because `.git` is read-only under Codex `workspace-write`, so the techlead set the loop `idle`. The driver's questions, Esc, stop, and continue therefore all hit an idle loop. The agent answered them sensibly, but none of the new code paths ran. The driver's `expect_file` gates timed out one by one, which is the right failure mode.
- [SANDBOX] LESSON: Codex `workspace-write` keeps `.git` read-only, so the loop's commit discipline cannot work. A disposable Codex sandbox needs `-s danger-full-access -a never` (approved by the user for this run) or a proven way to make `.git` writable.
- [SANDBOX] LESSON: `gpt-5.6-luna` did not follow the skill's "end the turn after binding; the Stop hook drives the roles" contract; Claude opus did. Use the user's default `gpt-5.6-sol` for Codex loop runs. Weak models are a separate compliance question.
- [SANDBOX] OBSERVATION: the host Claude Code process restarted mid-run. The background driver was lost and the scratchpad was partly cleared (the Codex source clone). Keep driver tooling and anything needed later in `sandbox-logs/<run>/artifacts/tools/`, not in the scratchpad.

- [FEATURE] PASS with one finding, Codex attempt 3 (`sandbox-user-prompt-codex2`, 0.162.0, `gpt-5.6-sol`, `-s danger-full-access -a never`). Same scenario, and the same event sequence as Claude:
  - steer: `user-message-in-turn` in engineer iter 3;
  - Esc: `turn-aborted` in engineer iter 5, then engineer iter 6 starts with "Resuming the engineer turn…";
  - "остановись": `user-message-in-turn` in techlead iter 7, then `stop-loop.mjs` gives `loop-stopped`;
  - "продолжай": `loop-start`, the loop runs to `idle`;
  - 3 commits (`80784db`, `20e5154`, `0a6e483`).
- [FEATURE] FINDING (fixed): on Codex the steer answer became the whole engineer report. The engineer answered "сейчас меняю два файла…" and ended the turn with that message, so the Stop hook recorded it as the report. The techlead noticed ("despite the overwritten quick-question engineer report") and closed the task from live evidence. Claude had folded the answer into its full report. Fix: the in-turn guidance now says "your final message must still be the complete <role> report, because the loop records it"; `SKILL.md` and `implementation-cycle.md` were updated to match. Re-verifying on a fresh Codex sandbox (`sandbox-user-prompt-codex3`).

- [FEATURE] PASS (steer wording), Codex attempt 4 (`sandbox-user-prompt-codex3`): the steer during engineer iter 3 got an answer, and the turn still ended with the full engineer report ("Mean slice выполнен полностью…"). The fix works.
- [FEATURE] INCONCLUSIVE beyond that point: the next engineer turn hit the user's ChatGPT usage limit ("try again at Oct 10th, 2026 2:58 AM"). A turn that fails on an API error fires no `Stop` on Codex. The driver's Esc plus question then correctly logged `turn-aborted` (new `turn_id`), but the question turn failed on the same limit, so nothing resumed. The driver was stopped by PID. The Esc/stop/continue code paths did not change after attempt 3, which passed them; only the in-turn wording changed.
- [FEATURE] OBSERVATION: an API-error turn and an Esc look the same to hooks on both hosts (no `Stop`). The new contract handles both the same way: the next user prompt closes the role turn as `turn-aborted` and resumes the role.

### 5. Archive and cleanup

- [SANDBOX] Archived into `artifacts/90-archive/<sandbox>/`:
  - a git bundle of each sandbox repo, verified and restore-tested by cloning it and running `npm test`: repro 1/1, fix 9/9, claude 9/9, codex 1/1, codex2 6/6, codex3 3/3. The probe had no commits, so its `hook-log.jsonl`, `steps.json`, and settings were copied directly;
  - `.epic-loop/` including `.runtime`, `uncommitted.diff`, and hook settings (`.claude/settings.json` or `.codex/hooks.json` + `config.toml`);
  - Claude host transcript directories, and the Codex rollouts for the sessions that ran hooks (`~/.codex/sessions/2026/10/**`, copied; the originals were left in the user's Codex history).
  - Driver logs, steps, and prompts are `artifacts/2x-*`, `3x-*`, `4x-*`, `5x-*`.
- [SANDBOX] Removed all 7 sandbox directories and their `~/.claude/projects/-projects-my-projects-epic-loop-workspace-sandbox-*` directories.
- [SANDBOX] Inventory of what was left:
  - `~/.claude.json` still has trust entries for `sandbox-probe-claude-interrupt` and `sandbox-user-prompt-claude`. They are harmless, and I left them alone because the running Claude Code process rewrites that file.
  - `~/.codex/config.toml` has no sandbox entries (trust was passed only through `-c`).
  - No background processes remain.
  - From the update incident: a stray `@openai/codex@0.162.0` in `~/.volta/tools/image/node/24.18.0/lib/node_modules/@openai` plus `bin/codex`. It is inert, because the Volta shim wins and the user has since updated Codex to 0.162.0 through Volta. Removing it is left to the user.
  - The npx cache (`epic-loop@0.2.1`) is kept on purpose.
- [SANDBOX] DECISION: reusable sandbox tooling now lives in this skill under `tools/`: `ptydrive.py` (pty driver with `forbid`), `codex-hook-hash.mjs`, and `codex-trust-args.mjs`. Heavy artifacts stay out of git.

## Summary

### [FEATURE]

- **Issue #4 reproduced** on published `epic-loop@0.2.1` on the first try. A `run_in_background` task's `<task-notification>` arrived as `UserPromptSubmit` mid-turn, which set `turn-interrupted` and `status: interrupted`. The next `Stop` gave `loop-not-running`, the engineer's finished work was never reported or committed, and nothing human-facing showed the stop.
- **Narrow fix verified**: synthetic prompts (only `<task-notification>`/`<system-reminder>`) are ignored. A real headless loop with background tasks in every engineer turn then ran to `idle`.
- **Contract changed (user decision)**:
  - A user message never stops the loop.
  - The loop tracks `turn_key` (`prompt_id` on Claude Code, `turn_id` on Codex).
  - Same `turn_key`: answer and finish the role with its full report.
  - New `turn_key` with an open turn (Esc / API error): `turn-aborted`, then the same role resumes after the user's turn.
  - Explicit stop: the agent runs `stop-loop.mjs` for any wording, and the hook handles `stop loop mode`.
  - Resume: `bind-session --mode implementation`.
- **Verified interactively on both hosts with the same scenario.**
  - Claude Code (opus) passed every step.
  - Codex 0.162 (`gpt-5.6-sol`) passed every step in attempt 3.
  - One Codex-only finding (the steer answer replaced the role report) was fixed in the wording and re-verified in attempt 4.
- Issue #4 proposal 3 (`resume-loop.mjs`) was not needed: rebinding already resumes. Proposal 2 (surface the stop in human-facing artifacts) is moot, because the loop now stops only at the user's explicit request.
- Unit tests 109/109, `pnpm run validate` OK, runtime copies synced (`self-update`, diff clean).
- **Open, separate items:**
  - The Codex doctor still requires `[features] hooks = true`, but hooks are on by default in Codex ≥ 0.145. The check is stale.
  - Hook-event capture filenames have one-second precision and may overwrite each other.
  - Codex goal and mailbox turns produce a `Stop` without `UserPromptSubmit` and are not classified.
  - Weaker models (`gpt-5.6-luna`) play the roles inline instead of ending the turn after binding.
  - Shipping needs a 0.2.2 release; the CLI package bundles the skill at build time.

### [SANDBOX]

- **Worked:**
  - Gating the scenario on `progress-log.jsonl` (`expect_file`) instead of sleeps. It follows the loop exactly and fails visibly (timeouts) when the loop does something else.
  - Hook captures in `.epic-loop/.runtime/hook-events` with `last_assistant_message` / `prompt` were enough to read what the agent said, even without transcripts.
  - `--setting-sources project` kept user-level hooks out (GitKraken did not run).
  - Codex trust passed as inline `-c` tables kept `~/.codex/config.toml` untouched.
  - A subagent researching Codex in parallel gave source-level facts that the run then confirmed.
- **Did not work / incidents:**
  - Blind typing into a TUI triggered Codex's self-update. Now there are mandatory `forbid` and `expect` gates and `check_for_update_on_startup=false`.
  - The Claude trust dialog defaults to "No, exit".
  - Standalone `sleep` is blocked by Claude Code.
  - Nested Claude sessions do not persist transcripts without `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1`.
  - Codex `workspace-write` makes `.git` read-only.
  - `gpt-5.6-luna` ignores the Stop-hook role contract.
  - The host process restart killed the background driver and cleared part of the scratchpad.
  - A broad `pkill -f` killed its own shell.
  - The final driver gate used the wrong idle marker.
  - Codex runs can hit the user's subscription limit.
- **Changes in `LEARNINGS.md`:** new decisions D-6 (interactive pty driving with `forbid`/`expect` gates), D-7 (Codex sandbox flags and trust), and D-8 (tools live in the skill). Confirmations were bumped, and new "Needs tuning" entries were added.
