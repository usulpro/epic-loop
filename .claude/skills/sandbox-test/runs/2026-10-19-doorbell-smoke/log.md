# Sandbox run: doorbell probe kit smoke (2026-10-19)

Run 9 of the `sandbox-test` skill.

Questions this run answers:

- [FEATURE] Does a ring wake an idle Claude Code interactive session without a human message, and does the woken turn read the answers file? Mechanisms: `asyncRewake` hook, `run_in_background` waiter.
- [FEATURE] Does `codex queue` wake an idle loaded Codex thread without a human message, and does the woken turn read the answers file?
- [SANDBOX] First use of the reusable doorbell probe kit (`tools/doorbell/`): installer, answers server, waiters, hook logger, probe log, latency summary.

Layout:

- Sandboxes (disposable): `<workspace>/sandbox-doorbell-claude-<variant>/`, `<workspace>/sandbox-doorbell-codex/`
- Heavy artifacts (local only, not in git): `<workspace>/sandbox-logs/2026-10-19-doorbell-smoke/artifacts/`
- Driver: `runs/2026-10-19-doorbell-smoke/driver/`

Versions: Claude Code 2.1.293, `codex-cli` 0.162.0, Node 24.18.0.

## Journal

### 0. Source research before the runs

- [FEATURE] OBSERVATION (Claude Code 2.1.293 binary, hook schema and handler):
  - `asyncRewake: true` "runs in background and wakes the model on exit code 2 (blocking error). Implies async."
  - The hook's `timeout` (seconds) applies to async and asyncRewake hooks too: `asyncTimeout = timeout ? timeout*1000 : 600000`. **The default is 10 minutes**, after which the hook process is killed. A session-long waiter needs an explicit large `timeout`. Whether there is an upper cap was not found.
  - On exit 2 the host enqueues a `task-notification` with priority `next`, `stopHookActive: true`, and the body `<rewakeMessage or 'Stop hook blocking error from command "<name>":'> <stderr or stdout>`. That is the same channel as background-task notifications. The user-facing summary defaults to "Stop hook feedback".
  - Undocumented, `@internal` options: `rewakeMessage` (the prefix shown to the model) and `rewakeSummary` (the one-line terminal summary).
  - A hook that exits 2 because its script cannot be opened is reported once, and identical repeats are dropped.
  - asyncRewake is backgrounded only in interactive sessions (or behind an internal gate). In `-p` mode the hook appears to run synchronously.
  - Not found: any explicit stderr length limit on the rewake body.
- [FEATURE] OBSERVATION (`codex-cli` 0.162.0):
  - `codex queue --thread <UUID or exact session name> --message <text>` exists.
  - `codex queue` also accepts `--remote <ws|unix addr>` for an app-server endpoint.
  - `--ignore-user-config` exists only on `codex exec`. The interactive TUI has no such flag.

### 1. Roll-out

- [SANDBOX] DECISION: one fresh sandbox per variant (`git init`, one README commit). The kit is installed with `tools/doorbell/install.mjs`. Hooks go only into the sandbox's project-local config, and the kit is copied to `<sandbox>/.doorbell/kit/`. Drivers: `driver/run-claude.sh <variant>` and `driver/run-codex.sh`.
- [SANDBOX] DECISION (Claude Code): an interactive session through `ptydrive.py`, configured with:
  - `--model sonnet --setting-sources project --permission-mode dontAsk`;
  - `--allowedTools Read "Bash(node:*)"`;
  - `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1` and a 15-minute timeout.

  The script acts as the human: it waits for the waiter to be armed and the setup turn's `Stop`, stays idle for 20 s, then runs `submit.mjs`.
- [SANDBOX] DECISION (Codex): the interactive TUI through `ptydrive.py`, because `codex exec` exits after its turn and an idle wake needs a loaded thread. It runs with:
  - `-m gpt-5.6-sol -c model_reasoning_effort=low -s workspace-write -a never`;
  - the user's two MCP servers disabled (`-c mcp_servers.<name>.enabled=false`, because the TUI has no `--ignore-user-config`);
  - inline hook and project trust from `codex-trust-args.mjs`;
  - `--no-alt-screen`, a 10-minute timeout, and a watchdog at 4 `Stop` events.

  No `danger-full-access`: the probe makes no commits. Expected size, stated at launch: two model turns (setup and woken), roughly 0.2–0.5 M input tokens, mostly cached.

### 2. Checks without an agent

- [SANDBOX] PASS: an agent-free self-test of the kit in the scratchpad exercised install (claude-code, `rewake-event` plus fallback), the server, `submit`, a rewake waiter (exit 2 with the pointer on stderr), a duplicate rewake waiter (skipped by the lock), the background waiter (exit 0 with the pointer on stdout), the fallback hook (silent before submit, inject after, silent after pickup), `pickup`, and `summary`. The lock was released and the server stopped on SIGTERM.

### 3. Agent sessions

Times are UTC from `probe-log.jsonl`; latencies are from `summary.mjs`.

**Claude Code, `asyncRewake` on `Stop` (`run-claude.sh rewake-event`, fallback hook also installed)**

- [FEATURE] PASS: a ring woke the idle session without a human message, and the woken turn read the answers.
  - 16:41:07.609: the setup turn ends; the `Stop` hook arms the waiter (`hook-fire`, then `waiter-armed`, timeout 86400 s).
  - 16:41:28.043: `submit` and ring (the answers file).
  - 16:41:28.166: `waiter-fired`, +123 ms; the hook exits 2.
  - 16:41:28.211: `UserPromptSubmit` fires, +168 ms. Its prompt is `<task-notification><summary>Stop hook feedback</summary></task-notification><system-reminder>Stop hook blocking error from command "Stop": Doorbell: …`.
  - 16:41:30: the model reads `answers.json`.
  - 16:41:31.798: `pickup` (`--via asyncRewake`), +3755 ms.

  The transcript shows no human message between the setup turn and the woken turn. The model saw the full pointer.
- [FEATURE] FINDING: a rewake (and a background-task notification, see below) reaches the session as a **`UserPromptSubmit` hook event whose `prompt` is the `<task-notification>` XML**.
  - Any `UserPromptSubmit` logic, such as epic-loop's user-prompt classification or the fallback hook, sees it as a prompt.
  - Here the fallback hook injected the pointer a second time (`hook_additional_context`) on that same event.
  - Phase 2 matrix work must check how epic-loop's hook classifies this event.
- [FEATURE] OBSERVATION: the waiter that the post-pickup `Stop` re-armed received **SIGTERM when Claude Code exited** (`waiter-killed` after 28.5 s). The host kills its async hook processes on exit, and no waiter was left behind.
- [FEATURE] OBSERVATION: the woken turn's `Stop` payload has `stop_hook_active: true`. The setup turn's has `false`.

**Claude Code, `run_in_background` waiter (`run-claude.sh background`, fallback hook also installed)**

- [FEATURE] PASS: a ring woke the idle session without a human message, and the woken turn read the answers.
  - 16:42:47.511: the model starts `waiter.mjs --mode background` as a background task (`waiter-armed`).
  - 16:42:49.333: the setup turn ends (`Stop`).
  - 16:43:09.555: `submit`.
  - 16:43:09.569: `waiter-fired`, +14 ms.
  - 16:43:09.618: `UserPromptSubmit` with the `<task-notification>` (status completed), +63 ms.
  - 16:43:14.658: `pickup`, +5103 ms.
- [FEATURE] FINDING: the background-task notification carries only the task id, the output-file path and a summary, **not the waiter's stdout**.
  - The model got the pointer from the fallback hook's injected context on the same `UserPromptSubmit`, and labelled the pickup `--via user-prompt`.
  - Without the fallback, the model would have to read the output file. A real design should put the pointer in the background command's description or rely on a hook injection.

**Codex, `codex queue` (`run-codex.sh`, interactive TUI, no fallback hook)**

- [FEATURE] PASS: a ring woke the idle loaded thread without a human message, and the woken turn read the answers.
  - 16:42:44.265: `register-thread`; `CODEX_THREAD_ID` was set in the session's shell.
  - 16:42:45.678: the setup turn ends (`Stop`).
  - 16:43:06.170: `submit`.
  - 16:43:06.171: ring with `codex queue --thread 01a1550b-… --message <pointer>`.
  - 16:43:06.498: exit 0, 327 ms: `Queued message … for thread …`.
  - 16:43:16.233: a new turn starts as `UserPromptSubmit` whose prompt is exactly the pointer (new `turn_id`), +10063 ms.
  - 16:43:19.817: `pickup` (`--via codex-queue`), +13646 ms.
  - 16:43:20.992: `Stop`.
- [FEATURE] CONFIRMED: the default sandbox is enough. `workspace-write` with `-a never` worked: the session wrote to `.doorbell/` and `codex queue` ran from the host. No `danger-full-access` and no global config change were needed.
- [FEATURE] CONFIRMED: an external writer's message is picked up in about 10 s (10.06 s here), which matches the SQLite-watcher delay from the research.
- [FEATURE] OBSERVATION: the queued message arrives as a normal user prompt. `UserPromptSubmit` sees the pointer text with no marker that it came from the queue, so a hook cannot tell it from a typed message by shape alone.
- [FEATURE] OBSERVATION: commands run inside the Codex sandbox report pid 4 and 5 (a pid namespace). Never use kit pids from inside a Codex session for process control.
- [SANDBOX] Codex size: 2 turns, 96,302 tokens (95,804 input, 86,400 of them cached; 498 output, 94 reasoning). This is under the 0.2–0.5 M stated at launch. The watchdog did not trigger.
- [SANDBOX] Claude size (Sonnet): `rewake-event` 4 messages, 134 k cache-read and 14 k cache-write input, 544 output; `background` 6 messages, 209 k cache-read and 14 k cache-write, 728 output. That is roughly $0.10 per session.

**Unconfirmed or open, for the matrix tasks**

- Whether there is an upper cap on the asyncRewake `timeout`. This run used 86400 s, but a session-long waiter was not held longer than about 1 minute.
- Any stderr size limit on the rewake body. The pointer was about 230 bytes.
- An unexplained `PreToolUse` (Bash) under the same session id about 1.5 s after every `Stop`, in both Claude sessions. It is absent from the main transcript; a hidden post-turn subagent is likely. It did not affect the probe.
- The sandbox session inherited `entrypoint: claude-vscode` from the host's environment, and claude.ai connectors and the user's skill listing despite `--setting-sources project`. That is harmless here, but the session is not fully isolated.

### 4. Fixes

- None. No product code was touched; the kit is test tooling.

### 5. Archive and cleanup

- [SANDBOX] Archived to `sandbox-logs/2026-10-19-doorbell-smoke/artifacts/<claude-rewake-event|claude-background|codex-queue>/`:
  - the install output and hook config;
  - the driver steps, raw pty log and driver notes;
  - the probe log and summary;
  - a git bundle of the sandbox (each one restore-tested by cloning it to the scratchpad);
  - the `.doorbell/` directory;
  - the host transcript, or the Codex rollout for the Codex run.
- [SANDBOX] Removed the three sandbox directories and the two `~/.claude/projects/<sandbox-path>` directories.
  - No `doorbell`, `ptydrive` or waiter processes remain (`pgrep`).
  - Claude Code killed the re-armed waiter on exit, and the drivers stopped the servers with SIGTERM.
- [SANDBOX] Left on purpose:
  - two trust entries in `~/.claude.json`, as in earlier runs;
  - the Codex rollout `~/.codex/sessions/2026/10/19/rollout-…01a1550b-2c95-….jsonl` and its thread in the Codex state DB, which is normal session history.
  - `~/.codex/config.toml` has no sandbox entries, because trust went through `-c` only.
- [SANDBOX] WORKAROUND: a cleanup `rm -rf` with shell variables was refused by the host's safety check, so it was rerun with literal paths. Cleanup scripts should use literal paths or `${VAR:?}`.

## Summary

- [FEATURE] All three mechanisms woke an idle session with no human message, and the woken turn read the answers file.

  | Mechanism | Ring → first hook | Ring → pickup | Notes |
  | --- | --- | --- | --- |
  | Claude Code `asyncRewake` (event, on `Stop`) | 168 ms | 3.8 s | The pointer reaches the model in the rewake body |
  | Claude Code `run_in_background` | 63 ms | 5.1 s | The notification has no stdout; the pointer came from the fallback injection |
  | Codex `codex queue` (idle TUI) | 10.1 s | 13.6 s | Default sandbox; the watcher delay is about 10 s |

  Both Claude Code wake paths arrive as a `UserPromptSubmit` carrying `<task-notification>` XML. The Codex queue message arrives as a plain user prompt. The matrix tasks must check how epic-loop's own `UserPromptSubmit` and `Stop` handling classify these events.
- [SANDBOX]
  - The kit worked on first use on both hosts.
  - A pty-driven idle session plus a script acting as the human (gated on probe-log lines) is a cheap pattern: about $0.10 per Claude session and 96 k tokens for Codex.
  - Codex TUI runs need `-c mcp_servers.<name>.enabled=false`, because `--ignore-user-config` exists only on `codex exec`.
  - Cleanup removals must use literal paths.
