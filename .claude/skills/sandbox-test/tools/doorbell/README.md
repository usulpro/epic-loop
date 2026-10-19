# Doorbell probe kit

Test tooling for one question: can a waiting agent session be woken without a human chat message after the human submits answers on a local page, and does the woken turn read the answers?

A "ring" is an external process writing `answers.json` (with `submittedAt`) and then triggering a mechanism that should start a new model turn. The answers file is the source of truth; the ring carries only a short pointer to it.

Node built-ins only. Nothing here touches global host config: the hooks go into the sandbox's project-local `.claude/settings.json` or `.codex/hooks.json`.

## Files

| File | Role |
| --- | --- |
| `install.mjs` | Options: `--rewake-timeout <s|default>` and `--rewake-pad <bytes>`. Copies the kit to `<sandbox>/.doorbell/kit/`, writes the project-local hook config for one variant, renders `<sandbox>/.doorbell/probe.md`, and gitignores `.doorbell/`. |
| `server.mjs` | Answers server on `127.0.0.1` (a dynamic port by default). It serves a form at `/` and `GET /status`; `POST /answers` writes `answers.json` and rings. Its port and pid go to `server.json`. |
| `submit.mjs` | CLI stand-in for the human pressing Submit: it POSTs to the running server. |
| `waiter.mjs` | `--mode background` is the `run_in_background` waiter (pointer on stdout, exit 0). `--mode rewake --form event\|session` is the `asyncRewake` hook command (pointer on stderr, exit 2). Only one rewake waiter runs at a time (`waiter.pid` lock). |
| `fallback-hook.mjs` | `UserPromptSubmit` fallback: when answers are pending, it injects the pointer as `additionalContext`. |
| `log-hook.mjs` | Passive logger for every hook event around the ring: `SessionStart`, `UserPromptSubmit`, `Stop`, and `PreToolUse` on Claude Code. It records `promptId`, the tool `command`, and the `Stop` `background_tasks` statuses. |
| `pickup.mjs` | Run by the woken session. It writes `pickup.json`, logs what the model saw (`--saw`) and how it was woken (`--via`), and prints the answers. |
| `register-thread.mjs` | Run by a Codex session. It stores `CODEX_THREAD_ID` in `thread-id` for the `codex-queue` ringer. |
| `summary.mjs` | Prints submit → ring → waiter fired → first hook → pickup latencies from the probe log. |
| `probe-claude.md`, `probe-codex.md` | Probe instruction templates. `install.mjs` renders the right one to `.doorbell/probe.md`. |
| `lib.mjs` | Shared helpers: args, paths, the probe log, and "answers pending" (`answers.json` newer than `pickup.json`). |

Probe directory (`<sandbox>/.doorbell/`, or `--dir` / `DOORBELL_DIR`):

- `answers.json`
- `pickup.json`
- `probe-log.jsonl` (append-only; every line has `at`, `event`, `pid`, plus `mechanism`, `hookEvent`, `sessionId`, `turnId`, `pointer` or `saw` where relevant)
- `server.json`
- `thread-id`
- `waiter.pid`

## Variants

| `--host` | `--variant` | What rings |
| --- | --- | --- |
| `claude-code` | `rewake-event` | An `asyncRewake` hook on `Stop` (timeout 86400 s) arms a waiter whenever a turn ends; on answers it exits 2 and the host wakes the model. |
| `claude-code` | `rewake-session` | The same waiter armed once on `SessionStart`. |
| `claude-code` | `background` | The session starts `waiter.mjs --mode background` as a background task; its exit is a task notification. |
| `claude-code` / `codex` | `fallback-only` | No ring. The pointer arrives with the next human message. Add `--fallback` to any other variant to install it as well. |
| `codex` | `codex-queue` | The server runs `codex queue --thread <thread-id> --message <pointer>`. The session registers its thread first. |

The Claude Code `asyncRewake` facts below come from the 2.1.293 binary; the 2026-10-19 smoke run log has the details.

- The hook `timeout` (seconds) also limits async and asyncRewake hooks, and the default is 600 s. A waiter needs an explicit large timeout.
- Exit 2 enqueues a task notification whose body is `<rewakeMessage or 'Stop hook blocking error from command "<name>":'> <stderr>`.
- It arrives in the session as a `UserPromptSubmit` whose prompt is the `<task-notification>` XML.

## Use

```bash
NODE="$(node -p process.execPath)"   # never a version-manager shim (see LEARNINGS "Process cleanup")
KIT=<repo>/.claude/skills/sandbox-test/tools/doorbell
"$NODE" $KIT/install.mjs --sandbox "$S" --host claude-code --variant rewake-event --fallback
"$NODE" $KIT/server.mjs --dir "$S/.doorbell" --ring file &          # or --ring codex-queue
# start the host session in $S with the prompt "Read .doorbell/probe.md and follow it exactly."
# wait until the setup turn ended (a Stop line in probe-log.jsonl), stay idle, then:
"$NODE" $KIT/submit.mjs --dir "$S/.doorbell" --answer "probe answer"
# wait for an "event":"pickup" line, then:
"$NODE" $KIT/summary.mjs --dir "$S/.doorbell"
```

The matrix driver `runs/2026-10-19-doorbell-claude-matrix/driver/run-cell.sh <cell>` runs one cell (mechanism × session state) per sandbox; `ptydrive.py`'s `run` step submits answers from inside the step list.

The smoke-run drivers in `runs/2026-10-19-doorbell-smoke/driver/` show complete runs:

- `run-claude.sh <variant>`: an interactive Claude Code session driven through `ptydrive.py`.
- `run-codex.sh`: the interactive Codex TUI through `ptydrive.py`. The TUI keeps the thread loaded.

## Cleanup

- An event-triggered rewake waiter re-arms after every turn and lives as long as its timeout. After a run, kill what `pgrep -f "$S/.doorbell/kit/waiter.mjs"` finds, and stop the server (SIGTERM).
- Do not use `pkill -f`.
