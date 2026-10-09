---
name: sandbox-test
description: Verify epic-loop (a feature branch, a published npm version, or both) end to end in a disposable sandbox project, driven by a real headless agent session, then archive and clean up. Use only when the user asks for a sandbox run, sandbox test, or disposable-sandbox verification.
argument-hint: "<what to verify, e.g. 'epic-loop@0.2.1 autoupdate'>"
disable-model-invocation: true
---

# Sandbox test (experimental)

> **Status: under active tuning.** This procedure comes from a small number of runs. Every run is also a test of the procedure itself. Expect steps that don't work, and record them. Do not quietly improvise around a step: log the deviation and why it was needed.
>
> Each run must leave two things in this skill:
>
> 1. a text run log in `runs/<YYYY-MM-DD>-<topic>/log.md`;
> 2. updates to `LEARNINGS.md`: confirm, revise, or add entries, and record decisions.
>
> Once enough runs have accumulated, `LEARNINGS.md` is consolidated back into this file and the skill is frozen (criteria in `LEARNINGS.md`).

Read `LEARNINGS.md` before starting. Its open issues and decisions override the steps below wherever they conflict.

Each run tracks two planes. Tag every log entry with one of them:

- **[FEATURE]**: what is being verified, i.e. the product behavior (pass/fail, findings, bugs, fixes).
- **[SANDBOX]**: how the sandbox method itself worked (decisions, workarounds, lessons).

Talk to the user in their language. The logs, `LEARNINGS.md`, and anything committed are English.

## 1. Plan the run

- Restate `$ARGUMENTS` as concrete pass/fail questions. Example: "does `npx epic-loop@X` replace doctor; does the loop chain through Stop hooks".
- Pick a topic slug and create the run log from `templates/run-log.md` at `runs/<YYYY-MM-DD>-<topic>/log.md`. Write in it as you go, not at the end.
- Paths:
  - sandbox: `<workspace>/sandbox-<topic>/`, where `<workspace>` is the parent directory of this repo;
  - local heavy artifacts: `<workspace>/sandbox-logs/<YYYY-MM-DD>-<topic>/artifacts/`, never committed.

## 2. Roll out

- Create a minimal fixture project. It should be just big enough for the behavior under test (for loop mechanics: one tiny module plus one `node --test` test). Run `git init -b main`, set a local `git config user.email/user.name`, and make an initial commit.
- Install the way a real user would. Use the published artifact (`npx --yes epic-loop@<version> install --platform claude-code`), or the documented install path under test. Run it with dev overrides unset: `env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR`.
- Run the checks you can make without an agent first (for example, doctor through the skill wrapper with `--json`). Save the outputs to `artifacts/`.

## 3. Drive with a real agent

Use a real headless session when the behavior involves hooks, session binding, or the loop:

```bash
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0 timeout 50m \
  claude -p "$(cat <prompt-file>)" --output-format stream-json --verbose \
  --permission-mode acceptEdits \
  --allowedTools "Read" "Edit" "Write" "Glob" "Grep" "Bash(node:*)" "Bash(npx:*)" "Bash(git:*)" "Bash(npm test:*)" "Bash(ls:*)" \
  --max-budget-usd 20 > artifacts/session.jsonl 2> artifacts/session.stderr
```

- The prompt pre-answers every question the skill would ask and states the approvals explicitly. Copy it into the run directory as `session-prompt.txt`.
- Run it in the background and wait for the completion notification. Do not poll.
- Never use `--dangerously-skip-permissions`; widen the allowlist instead and log why.
- Behavior that needs a real TUI (Esc, typing while the agent works) and Codex runs: follow `LEARNINGS.md` D-6/D-7 and use `tools/ptydrive.py` and `tools/codex-trust-args.mjs`.

## 4. Observe from the right sources

- The epic's own traces: `.epic-loop/epics/<slug>/.runtime/progress-log.jsonl` (role chain, iterations), `runtime-state.json`, and `.epic-loop/.runtime/` (bindings, hook events).
- The host transcript: `~/.claude/projects/<sandbox-path-with-dashes>/<session>.jsonl`. Look for `hook_blocking_error` attachments and "Stop hook feedback" messages, which are the Stop-hook continuations.
- `session.jsonl` (stream-json) only gives tool calls, permission denials, and the final result. It does not show hook continuations.
- The sandbox's git log and test results.

## 5. Fix

- Fix product bugs in this repository, never in the sandbox copy. Add a regression test, make the test environment scrub any host env vars the product reads, and run `pnpm run test:unit` and `pnpm run validate`.
- Re-verify against a fresh sandbox scenario. Use the local CLI (`EPIC_LOOP_CLI=<repo>/packages/cli/src/cli.mjs`) when the fix isn't published yet, and say so in the log.
- Commit fixes locally. Pushing and releasing need the user's go-ahead.

## 6. Archive, then clean

- Archive into `artifacts/`:
  - `git bundle create … --all` of the sandbox repo. Restore-test it by cloning it to the scratchpad and running its tests.
  - The `.epic-loop/` tree including `.runtime`.
  - The sandbox's hook settings.
  - The host transcript directory.
- Remove the sandbox directory and `~/.claude/projects/<sandbox-path-with-dashes>/`.
- Take inventory of global leftovers: `~/.claude.json` entries for the sandbox path, background processes, the npx cache. Record what was removed and what was deliberately kept.

## 7. Close the run

- Finish the run log with a two-plane summary: [FEATURE] verdict and open items; [SANDBOX] what worked, what didn't, and what to change.
- Update `LEARNINGS.md`:
  - increment confirmations on practices that worked again;
  - move anything that failed to "Needs tuning" with what happened;
  - add new decisions with the run id.
- Commit the run log and `LEARNINGS.md` changes. They belong on `main` through the normal branch/PR flow.
- Report to the user in both planes, with links to the run log.
