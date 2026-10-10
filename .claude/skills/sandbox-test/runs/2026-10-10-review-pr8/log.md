# Sandbox run: PR #8 review findings (2026-10-10)

Run 3 of the `sandbox-test` skill.

A code review of PR #8 (`fix/bg-task-notification-interrupt`) produced findings from reading the code. The user asked for each one to be reproduced in a sandbox before it goes on the PR as a review comment.

Questions this run answers:

- [FEATURE] Bug A (`loop-user-prompt.mjs:48`): after Esc aborts an engineer turn that started a `run_in_background` task, does the task's `<task-notification>` start a new host turn (new `prompt_id`)? Is it then ignored as synthetic, and does the reply to the notification get recorded as the engineer report?
- [FEATURE] Bug B (`loop-user-prompt.mjs:130`): when Esc lands in a techlead turn after `set-next-role engineer`, does `abortOpenTurn` overwrite `next_role` with `techlead` and re-run the techlead? What does the re-run techlead do with the work that already landed?
- [FEATURE] Bug C (`loop.mjs:256`, cap proximity drops the resume): is it reachable at all? (Analysis below; no agent run.)
- [SANDBOX] Try a `runtime-state.json` history watcher (`tools/state-history.mjs`), because the file is overwritten on every transition. Try marker files written by the fixture scripts as precise driver gates.

Layout:

- Sandbox (disposable): `/projects/my-projects/epic-loop-workspace/sandbox-review-pr8/`
- Heavy artifacts (local only, not in git): `/projects/my-projects/epic-loop-workspace/sandbox-logs/2026-10-10-review-pr8/artifacts/`

## Journal

### 0. Triage without an agent

- [FEATURE] DISMISSED, bug C. Proximity routes to manager only when `cap - consecutive_blocks <= 1`. After an abort, the user's answer turn is a fresh host turn, so its `Stop` has `stop_hook_active: false` and `resetClaudeBlockCountForTurn` sets `consecutive_blocks` to 0 first. Proximity can then trigger only with `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=1`. Under cap 1, every user turn's first `Stop` routes to manager and the second hits the cap, so the loop never reaches an engineer turn that could be aborted. Not reachable; no sandbox run needed.
- [FEATURE] NOT A PR ISSUE, unquoted `SKILL_DIR` in `stopHint` / `resumeCommand`. All role templates already use unquoted `{{SkillDir}}` paths (e.g. `implementation-techlead-prompt.md`), so a project path with a space breaks the loop before these hints matter. Pre-existing and codebase-wide; it belongs in a separate issue, not this PR.
- [FEATURE] NOT A PR ISSUE, `payload.turn_id` in turn-start/turn-stop logs and `last_stop_turn_id`. Those lines are unchanged by the PR. Observability only.
- [FEATURE] NOT REPRODUCED ON PURPOSE, the remaining review items: the null `turn_key` → abort rule is a documented design decision; duplicate interrupt writers and the hot-path roadmap parse are cleanups, not bugs; the "engineer turns are skill-agnostic" item is wording.

### 1. Roll-out

- [SANDBOX] DECISION: the run 2 fixture (restored from its git bundle, initial commit `d42e7a1`) with two changes. `scripts/slow-check.mjs` now runs 45 s and appends `started` / `finished` lines to `.sandbox/markers.log`. The new `scripts/techlead-gate.mjs` (25 s, same markers) widens the window between the techlead's `set-next-role` and its `Stop`, so Esc can land there deterministically. `.sandbox/` is gitignored.
- [FEATURE] PASS: local-CLI install from the branch (`node packages/cli/src/cli.mjs install --platform claude-code`, dev overrides and block cap unset). The skill copy is identical to `plugins/epic-loop/skills/epic-loop` (`diff -rq` clean). `artifacts/01-install.txt`.

### 2. Checks without an agent

- [FEATURE] PASS: doctor through the skill wrapper with `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0`: `ready`, `skill.source=env`, CLI 0.2.1. `artifacts/02-doctor-wrapper.json`.

### 3. Interactive agent session

- [SANDBOX] DECISION: one interactive Claude Code session (2.1.293, opus) driven by `tools/ptydrive.py`, covering both bugs in sequence. Flags per D-6: `--setting-sources project`, `--permission-mode dontAsk` plus allowlist (now with `Monitor` and `Bash(npm:*)`), `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1`, cap 0. The prompt is run 2's prompt plus a "techlead protocol": run `node scripts/techlead-gate.mjs` in the foreground right after `set-next-role`. `artifacts/03-prompt.txt`, `artifacts/04-steps.json`.
- [SANDBOX] Scenario:
  - bug B: gate on `set-next-role … "next_role":"engineer"` in `progress-log.jsonl`, Esc after 1 s, then ask "what were you doing just now? one sentence.";
  - bug A: gate on `slow-check started` in `.sandbox/markers.log`, Esc after 8 s, then type nothing and wait for the notification;
  - then let the loop run to `"status":"idle"`.
- [SANDBOX] `tools/state-history.mjs` snapshots `runtime-state.json` on every change into `artifacts/05-state-history/`.
- [SANDBOX] LESSON: Claude Code 2.1.293 has no "? for shortcuts" text on screen, so the composer `expect` timed out after 40 s and the driver typed anyway (the prompt still landed). The composer marker is `❯` between two horizontal rules; gate on that next time.
- [SANDBOX] OBSERVATION: the session ran 11 iterations to `idle` in about 9 min, with 3 task commits (`0be146a`, `8fa000d`, `d39d4c4`). No permission dialog hung the pty.

#### Bug B: Esc in a techlead turn after `set-next-role engineer`

- [FEATURE] CONFIRMED (mechanism), low impact. Timeline from `progress-log.jsonl` and `artifacts/05-state-history/`:
  - `16:26:18` techlead iter 2 runs `set-next-role engineer` (snapshot 0006: `next_role: engineer`, `prompt_file` set). Esc lands 1 s later, before `techlead-gate.mjs` starts.
  - `16:26:24` the question turn logs `turn-aborted`. Snapshot 0007: `next_role: techlead`, `resume_after_user_turn: true`. The techlead's decision is overwritten.
  - `16:26:27` the next `Stop` starts techlead iter 3 with the resume note, not the engineer.
  - Iter 3 (transcript): it runs `role-summary` and `git status`, sees the task started and the brief written, re-runs `set-next-role engineer` (reason "re-applied after interrupted techlead turn"), runs the gate, and ends. No duplicate `start-task`, brief, or tracker change.
  - Cost: one extra techlead turn (40 s here, 25 s of it the artificial gate). The resume note was enough for opus to recover; correctness then depends on the model.
- [FEATURE] BUG (new, found while reading the evidence), `turn-aborted` is invisible to the progress report:
  - `abortOpenTurn` logs `ended_at` but no `timestamp`. Every other progress event has one.
  - `rebuildProgressReport` / `collectOpenTurns` (`loop-artifacts.mjs`) count only `turn-stop` and `turn-interrupted`. After `rebuild-progress`, `progress-report.md` lists "Turn 2 | techlead" under "Open Turns" for good, says "Interrupted turns: 0", and leaves the aborted turn's time out.
  - `rebuildProgressMarkdown` falls back to `nowIso()` for the missing timestamp, so the rebuilt `progress-log.md` dates the abort to the rebuild time (`16:34:58` instead of `16:26:24`).

#### Bug A: Esc in an engineer turn with a running background task

- [FEATURE] CONFIRMED (mechanism), NO HARM observed. Timeline:
  - `16:27:16` engineer iter 4 starts `slow-check.mjs` in the background. Esc lands 8 s later. No `Stop` fires.
  - The background task survives Esc (`slow-check finished 16:28:01`).
  - `16:28:01` its `<task-notification>` starts a new host turn on its own: the `UserPromptSubmit` capture has `prompt_id` `3971626f…`, while the loop's `turn_key` is `a49c1926…`. The hook logs `synthetic-prompt-ignored` and leaves the engineer turn open.
  - `16:28:08` the reply's `Stop` records it as the engineer report and chains to techlead.
  - The recorded report is a complete engineer report (changed files, `npm test` 3/3, the protocol steps, `slow-check: OK`). The model treated the notification as the cue to finish its role.
- [FEATURE] VERDICT: not worth a fix. A background task's notification can only arrive after the engineer started it, which is late in the turn, and the notification turn carries the full role context. The proposed fix (abort on a synthetic prompt with a new `turn_key`) would only add one more engineer turn to rewrite the same report.
- [FEATURE] OBSERVATION: Esc did not stop the loop here; the notification resumed it without user input. That is Claude Code waking the session, not the loop's doing, and the proposed fix would not change it either.

### 4. Fixes

- [FEATURE] None in this run. The confirmed items (bug B and the `turn-aborted` progress-report bug) go to PR #8 as review comments. Bug A and the dismissed items do not.

### 5. Archive and cleanup

- [SANDBOX] Archived into `artifacts/90-archive/`: git bundle (verified and restore-tested by cloning it and running `npm test`: 6/6), `.epic-loop/` including `.runtime`, `.claude/settings.json`, `.sandbox/markers.log`, `uncommitted.diff`, and the host transcript directory.
- [SANDBOX] Removed the sandbox directory and `~/.claude/projects/-projects-my-projects-epic-loop-workspace-sandbox-review-pr8/`. No background processes remain. `~/.claude.json` keeps one trust entry for the sandbox path (left alone, as in run 2). The npx cache is kept.

## Summary

### [FEATURE]

- **Bug B confirmed, low impact.** `abortOpenTurn` overwrites a `next_role` the techlead already set. The techlead re-ran, recovered from the resume note, and re-applied the same decision. Cost: one extra turn. No state corruption.
- **New bug confirmed.** `turn-aborted` has no `timestamp`, and the progress report does not know the event: the aborted turn stays under "Open Turns" for good, "Interrupted turns" is 0, and a rebuild re-dates the event.
- **Bug A: mechanism confirmed, no harm.** A notification after Esc starts a new host turn with a new `prompt_id` and is ignored. Its reply is recorded as the engineer report, but that reply is the complete report.
- **Bug C dismissed** by analysis: it needs cap 1, under which no engineer turn ever runs.
- Unquoted skill paths and `payload.turn_id` logging predate the PR and belong in separate issues.

### [SANDBOX]

- **Worked:**
  - Covering two bugs in one interactive session with gates on the product's own trace.
  - Marker files written by fixture scripts (`.sandbox/markers.log`) as precise gates, and as proof that the background task survived Esc.
  - `tools/state-history.mjs`: the overwritten `runtime-state.json` became a readable history, and it was the decisive evidence for bug B.
  - An artificial slow step (`techlead-gate.mjs`) to widen a race window. It was not needed this time (Esc landed 1 s after `set-next-role`), but it costs little.
  - A Monitor on driver markers plus progress events instead of polling.
- **Didn't work:** the composer `expect` regex (see the lesson above), and the Monitor's progress regex missed `turn-start`, whose long `prompt_file` pushes `role` beyond 80 characters.
- **Changes in `LEARNINGS.md`:** D-9 (state history plus marker files), confirmations bumped, the composer marker added to "Needs tuning".
