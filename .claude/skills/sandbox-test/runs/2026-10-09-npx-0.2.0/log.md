# Sandbox run: epic-loop@0.2.0 via npm (2026-10-09)

Two tracks are logged together:

- **[FEATURE]**: verification of `feature/distribution-foundation` and published `epic-loop@0.2.0`. Does the npm CLI replace what it should (so far only `doctor`), and do the wrapper, install, hooks, and epic loop mechanics work end-to-end?
- **[SANDBOX]**: how disposable sandboxes are rolled out, tested, fixed, and cleaned. Covers decisions, workarounds, and lessons.

Layout:

- Sandbox (disposable, deleted after the run): `/projects/my-projects/epic-loop-workspace/sandbox-npx-020/`
- This log and the session prompt (`session-prompt.txt`): committed here, in the skill's `runs/`.
- Heavy artifacts (local only, not in git): `/projects/my-projects/epic-loop-workspace/sandbox-logs/2026-10-09-npx-0.2.0/artifacts/`. The `artifacts/NN-*` names below refer to that folder: the stream-json transcript, the host transcript, a git bundle of the sandbox repo, and doctor JSON outputs.

Run 1 of the `sandbox-test` skill. It predates the skill: the skill's procedure and `LEARNINGS.md` were distilled from this run.

## Journal

### 1. Roll-out

- [SANDBOX] Decision: the sandbox lives next to the repo (`epic-loop-workspace/sandbox-npx-020/`) and has its own `git init`. Logs go to a sibling `sandbox-logs/<date>-<topic>/` so they outlive cleanup. The fixture is deliberately tiny (`src/stats.mjs` with `sum` + one `node --test` test) so the epic is about loop mechanics, not product work.
- [SANDBOX] Decision: install exactly the way a user would, with `npx --yes epic-loop@0.2.0 install --platform claude-code`, running with `EPIC_LOOP_CLI` and `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` unset so no dev override leaks in from the host shell. Output: `artifacts/01-install.txt`.
- [FEATURE] PASS: `install` copied skill 0.2.0 into `.claude/skills/epic-loop`, wrote `platform.json`, and installed all 3 hooks pointing at the sandbox copy. Its trailing doctor reported only the block cap as missing.
- [FEATURE] FINDING (minor UX, inherited from the original doctor): when hooks are already installed and only `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` is missing, doctor's "Next:" still says to run `install-hooks.mjs`. It should only suggest the env var.
- [FEATURE] FINDING (minor): `install` does not add `.epic-loop/.runtime/` entries to the project `.gitignore`. That only happens later, in `init-epic`. Fine for now; to revisit when `install` owns more of setup.

### 2. Doctor through the real npm path

- [FEATURE] PASS: `node .claude/skills/epic-loop/scripts/epic-loop.mjs doctor --platform claude-code --json` (no dev override) reported `ready`, `skill.source=env` (path came from the wrapper), skill 0.2.0 = cli 0.2.0, `update: none` (registry latest 0.2.0), no warnings. Took about 300 ms, served from the npx cache (`~/.npm/_npx/be92558bd43da3f7`). Output: `artifacts/02-doctor-wrapper.json`.
- [FEATURE] PASS: the installed skill routes exactly one operation through npm: `epic-loop.mjs doctor` (6 references across SKILL.md and references). 16 other scripts are still called directly (install-hooks, set-next-role, role-summary, bind-session, …), as designed for this step. No `doctor.mjs` references remain anywhere in the installed skill (SKILL.md, references, templates, loop prompts).

### 3. Headless agent session (the epic itself)

- [SANDBOX] Decision: drive the epic with a real headless Claude Code session (`claude -p`, `--output-format stream-json --verbose`), not by calling scripts by hand. Only a real session exercises the hooks, session binding, and Stop-hook role chaining. The prompt pre-answers shaping questions and pre-approves implementation (`artifacts/03-session-prompt.txt`). Guards: `--max-budget-usd 20`, `timeout 50m`, `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0`, `EPIC_LOOP_CLI`/`EPIC_LOOP_SKILL_DIR` unset. Sandbox git identity is set locally (`git config user.*`) so loop commits don't depend on global config.
- [SANDBOX] WORKAROUND: the first launch with `--dangerously-skip-permissions` was blocked by the host session's auto-mode classifier ("Create Unsafe Agents"). Relaunched with `--permission-mode acceptEdits` plus a narrow `--allowedTools` list (Read/Edit/Write/Glob/Grep, `Bash(node:*)`, `Bash(npx:*)`, `Bash(git:*)`, `Bash(npm test:*)`, `Bash(ls:*)`). Lesson: nested agents should get a scoped allowlist from the start. That is safer, and it also documents exactly which commands the skill needs; anything the skill needs beyond it will show up as a denial in the transcript.
- [FEATURE] PASS, end to end: session `8b22a6d8…` ran the epic in about 4 min (71 turns, $2.66). First Move ran doctor through the wrapper and npm (0.2.0, `ready`), then `init-epic`, shaping (1 phase / 3 tasks), `bind-session --current`, and the implementation loop. `progress-log.jsonl` shows the full Stop-hook chain: manager → techlead → engineer (mean) → techlead → engineer (median) → techlead → engineer (verification) → techlead → manager (phase closure) → techlead → `idle`. That is 10 consecutive blocks in uncapped mode (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0`), with no cap pause. Result: 3 task-owned commits (`86fc580`, `b750e74`, `d9bf609`), `npm test` 8/8, all 3 tracker tasks `[x]`.
- [FEATURE] PASS: the hook path stays `node <skill>/scripts/hook.mjs` (not via npm), as designed for this step. Each Stop hook took about 40 ms.
- [FEATURE] OBSERVATION (pre-existing skill behavior, not from this branch): during shaping the agent hand-wrote `.runtime/roadmap-state.json` with the Write tool. No script defines phases or tasks during shaping, which goes against "mechanical changes through scripts". Candidate for the CLI command surface (Phase 4/5 of `standalone-npx`).
- [FEATURE] OBSERVATION (pre-existing): the last implementation-log line (commit hash of the final task) stays uncommitted by design ("no commit just for a log line"). Leaves the tree dirty after an epic finishes.
- [SANDBOX] LESSON: `--output-format stream-json` does **not** show Stop-hook continuations as user events. It only shows a `notification` "Stop hook error occurred". This is cosmetic: Claude Code represents `decision: block` as `hook_blocking_error`. The truth is in the host transcript (`~/.claude/projects/<sandbox-path>/<session>.jsonl`: `hook_blocking_error` attachments and "Stop hook feedback" user messages) and in the epic's `.runtime/progress-log.jsonl`. Check those, not the stream.
- [SANDBOX] LESSON (isolation leak): the sandbox session also ran the user's global Stop hook (`gk ai hook run --host claude-code`, GitKraken) and loaded all user-level skills and plugins. It was harmless here, but a sandbox is not hermetic by default. Next time, consider `--setting-sources project` or a throwaway `CLAUDE_CONFIG_DIR`, and note what leaks in.
- [SANDBOX] LESSON (allowlist friction): 5 permission denials, all from compound shell commands (`cmd; echo $?`, `| head`, `cd … && git …`). The agent recovered each time by splitting the command. The skill itself needs only `node`, `git`, and `npm test`. Expect this friction with any narrow allowlist; it is a useful signal, not a blocker.

### 4. Upgrading a pre-wrapper install through npm (realistic migration path)

- [SANDBOX] Decision: copy a real old install (`uRec/.claude/skills/epic-loop`, no `scripts/epic-loop.mjs`) into `sandbox/legacy-project/`. This reproduces the state of the ~13 existing local installs.
- [FEATURE] PASS: `npx epic-loop@0.2.0 doctor` (CLI run directly, skill discovered) warns "predates versioned skills; update it to 0.2.0". `npx epic-loop@0.2.0 update` swapped the copy atomically (`from: null → 0.2.0`). The updated copy's wrapper then runs doctor through npm (`source: env`, version 0.2.0). Artifacts `05-*`.
- [FEATURE] BUG (fixed on the branch, `d8c2485`): for a copy without a version, doctor's update check reported `available: false` with no `command`. So the agent was never shown the update command, and `autoupdate` never fired for exactly the installs that need it most. Fix: a null skill version counts as older than any published version. Covered by a new unit test; verified against a fresh real legacy copy with the local CLI (`06-legacy-doctor-fixed.json`: `available: true`, `notify`, correct command). **Needs a 0.2.1 release to reach npm.**
- [FEATURE] FIX (same commit): when hooks are installed and only the block cap is missing, the Claude doctor "Next:" line now asks only for `export CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0`. Asserted in the install test.
- [SANDBOX] LESSON: tests inherited `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` from the host shell. The new assertion would flip depending on the developer's environment. `baseEnv` in `cli-package.test.mjs` now strips it too. Any env var the product reads must be scrubbed in tests.
- [FEATURE] NOT TESTABLE YET: autoupdate through real npm needs an older wrapper-capable version than `latest`. That only exists once 0.2.1 ships. Covered by unit tests with `EPIC_LOOP_CLI` meanwhile.

### 5. Archive and cleanup

- [SANDBOX] Archived before deleting:
  - `07-sandbox-repo.bundle`: `git bundle --all`, verified, and restore-tested by cloning it back and running `npm test`, 8/8.
  - `07-sandbox-state/`: the `.epic-loop/` tree including `.runtime`, the sandbox `.claude/settings.json`, and the uncommitted diff.
  - `08-host-transcript/`: the Claude Code project dir for the sandbox path, including `tool-results/`.
- [SANDBOX] Side-effect inventory:
  - Sandbox dir: removed.
  - `~/.claude/projects/-projects-my-projects-epic-loop-workspace-sandbox-npx-020/`: removed. Claude Code creates it for any session started in the sandbox path, so cleanup must remove it too.
  - `~/.claude.json`: no entry for the sandbox path. Nothing to do.
  - Background processes: none.
  - npx cache `~/.npm/_npx/be92558bd43da3f7` (`epic-loop@0.2.0`): **kept on purpose**. It is shared with real use, and deleting it would only force a re-download.
- [SANDBOX] Result: `epic-loop-workspace/` again contains only `epic-loop/` plus `sandbox-logs/`.

## Summary

### [FEATURE] `feature/distribution-foundation` / `epic-loop@0.2.0`

- The npm path works for what 0.2.0 is supposed to replace, which is `doctor` only:
  - `npx epic-loop@0.2.0 install` works;
  - doctor runs through the wrapper and npm (about 300 ms from the npx cache, skill dir passed via env, versions match, registry check OK);
  - the installed skill has no leftover `doctor.mjs` references;
  - every other operation still calls skill scripts directly, as designed.
- A full real epic ran on top of it: shaping, binding, and an uncapped manager/techlead/engineer loop through Stop hooks to `idle`, with 3 commits and green tests.
- Migrating old installs works with one command: `npx epic-loop@0.2.0 update`.
- Fixed on the branch (`d8c2485`, not pushed, **needs 0.2.1**):
  - legacy copies were never offered an update and never autoupdated;
  - the doctor "Next:" hint was misleading.
- Open, pre-existing (not from this branch): there is no script for defining phases and tasks during shaping, so the agent hand-writes `roadmap-state.json`; the final log line is left uncommitted.
- Not covered: autoupdate through real npm (needs 0.2.1 on the registry); plugin installs; Codex.

### [SANDBOX] Playbook distilled from this run

1. **Layout.** The sandbox `<workspace>/sandbox-<topic>/` gets its own `git init` and a local git identity. Logs and artifacts go to `<workspace>/sandbox-logs/<date>-<topic>/`, outside the sandbox.
2. **Install like a user.** Use the published artifact (`npx pkg@version`), with every dev override env var unset.
3. **Drive with a real agent.** Use `claude -p` with a pre-answered prompt and budget/time guards. Give it a narrow `--allowedTools` allowlist; never use `--dangerously-skip-permissions`, which the host auto-mode blocks anyway.
4. **Observe from the right sources.** Use the product's own traces and the host transcript under `~/.claude/projects/<path>/`. Don't rely on the stream-json output, which hides hook continuations.
5. **Expect host leakage.** User-level hooks, skills, and plugins load into the sandbox session. Isolate (`--setting-sources`, `CLAUDE_CONFIG_DIR`) when it matters.
6. **Fix in the source repo, not in the sandbox.** Add a regression test, scrub host env vars in tests, then verify the fix back in a fresh sandbox scenario with the dev override.
7. **Archive, then clean.** Make a git bundle (and restore-test it), copy the state and the host transcript, then remove the sandbox and `~/.claude/projects/<sandbox-path>`. Inventory the global state (`~/.claude.json`, processes, caches) and write down what is deliberately kept.
