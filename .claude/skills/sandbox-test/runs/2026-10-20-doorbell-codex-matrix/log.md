# Sandbox run: Codex terminal doorbell matrix (2026-10-20)

Run 11 of the `sandbox-test` skill.

Questions this run answers:

- [FEATURE] Does `codex queue` wake a waiting Codex 0.162.0 TUI in each session state? The states are: mid-turn (QB), after Esc (QD), 15 min idle (QE), closed then `codex resume` (QF), and a TUI attached to its own app server through `--remote` (QR). The idle state was covered by the run 9 smoke.
- [FEATURE] Does the `UserPromptSubmit` fallback inject the pointer on Codex (FA)?
- [FEATURE] How do epic-loop's hooks classify a queued message during a loop (C)? And can loop commits work without `danger-full-access`?
- [SANDBOX] A Codex variant of the generic cell driver, with a per-cell watchdog and a total token budget of 2 M.

Layout:

- Sandboxes (disposable): `<workspace>/sandbox-dbc-<cell>/`
- Heavy artifacts (local only): `<workspace>/sandbox-logs/2026-10-20-doorbell-codex-matrix/artifacts/<cell>/`
- Driver: `driver/run-ccell.sh <cell>` and `driver/make-steps.mjs`. The script body sits in `main()`, so bash parses it whole before running (run 10 lesson).

Versions: `codex-cli` 0.162.0 (`gpt-5.6-sol`, `model_reasoning_effort=low`), Node 24.18.0.

## Journal

### 0. Research without a model (no quota used)

- [FEATURE] **Shared daemon:** `codex app-server daemon version` fails ("failed to connect to …/app-server-control.sock"), so no shared app-server daemon is running on this machine. `daemon_auto_start` is a stable feature, enabled by default.
  - The only app servers running belong to the VS Code extension (`codex app-server`, started by the extension).
  - The plain TUI therefore runs **embedded**, and so did the run 9 smoke. `codex queue` reached it without any socket, through the shared state store (the smoke log shows "Queued message … for thread …").
  - The shared daemon was not started here: that would be a machine-wide side effect. The non-embedded mode is covered with a private `codex app-server --listen unix://<path>` and `codex --remote unix://<path>` (cell QR).
- [FEATURE] **`.git` under `workspace-write`, checked with `codex sandbox` on a scratch repo (no model):**
  - `codex sandbox -P :workspace` lets the command write files, but `git commit` fails: "Unable to create …/.git/index.lock: Read-only file system".
  - Adding `-c 'sandbox_workspace_write.writable_roots=["<repo>/.git"]'` gives the same failure. The `.git` protection is not lifted by a writable root.
  - `sandbox_workspace_write.writable_roots` exists in the 0.162 config schema, but I found no setting that makes the workspace's own `.git` writable short of `danger-full-access`. Whether `-c` overrides apply under `-P :workspace` was not confirmed.
  - DECISION: **cell C is deferred**. It needs the human's approval for `danger-full-access` (sandbox-test D-7).

### 1. Roll-out

- [SANDBOX] DECISION:
  - One sandbox per cell, with the kit installed through `install.mjs --host codex`. FA uses `fallback-only`; the other cells use `codex-queue`, without the fallback.
  - Codex flags as in run 9:
    - `-m gpt-5.6-sol -c model_reasoning_effort=low -s workspace-write -a never`;
    - the user's MCP servers disabled;
    - inline trust;
    - `--no-alt-screen`.
  - A 25-minute timeout and a watchdog at 5 `Stop` events per cell.
- [SANDBOX] Expected size, stated before launch: QB, QD, QF, QR and FA about 2–3 model turns each, roughly 0.1–0.2 M tokens per cell; QE 2 turns, about 0.1 M. Total about 0.6–1.1 M, under the 2 M budget. Cell C (deferred) would have cost about 2–4 M.

### 2. Cells

Times are UTC from each cell's `06-probe-log.jsonl` and the Codex rollouts; latencies (from submit) are from `07-summary.txt`. The ring is `codex queue --thread <id> --message <pointer>`, run by the answers server. It exited 0 in 189–222 ms in every cell, printing `Queued message <id> for thread <id>`.

**Batch 1: six cells in parallel, from 17:15:56**

- [SANDBOX] FINDING: between about 17:16 and 17:21, Codex model requests **stalled**. After a user message the rollout records `task_started` and the `UserMessage`, then nothing for minutes.
  - QB's and QD's long-command turns never got a model response (QB waited 4.5 min).
  - QF's and FA's setup turns took about 5 min.
  - QE's setup turn (17:15:59) was not affected.
  - Turns after 17:21 completed normally, so this was service-side or concurrency-related, not a doorbell effect.
  - QB and QD were rerun one at a time. The first attempts are kept as `artifacts/QB-attempt1` and `QD-attempt1`.
- [SANDBOX] BUG (driver): QR's private app server refused its socket path ("socket parent must be owned by the user or root and prevent other users from replacing socket entries"), so the TUI could not connect. No tokens were used. Fixed with a `mkdir -m 700` socket directory, then QR was rerun (kept as `QR-attempt1`).

**QE, ring after 15 min idle**

- [FEATURE] PASS:
  - The setup turn ended at 17:16:04.
  - Ring at 17:31:07.878.
  - A new turn started at 17:31:17.286 (`UserPromptSubmit` whose prompt is the pointer, new `turn_id`), +9.4 s.
  - Pickup at +13.4 s.

**QF, closed, queued while closed, then `codex resume <thread id>`**

- [FEATURE] PASS:
  - The TUI was closed at 17:21:15. `codex queue` against the unloaded thread still exited 0 ("Queued message …"): the message is stored durably.
  - `codex resume` started at 17:21:18.
  - `SessionStart` (`source: resume`) came at 17:21:21.365, and **the queued message was dispatched on its own 28 ms later** (`UserPromptSubmit` with the pointer).
  - Pickup at +9.0 s from the submit (about 3 s after the resume).
  - The human's "ok" afterwards was an ordinary turn.

**FA, the `UserPromptSubmit` fallback on Codex**

- [FEATURE] PASS:
  - The fallback hook returned `additionalContext` with the pointer on the human's "ok" (`injected: true`), and the model picked up (+28.8 s).
  - Caveat: because of the stall, the setup turn was still running when "ok" was typed, so "ok" arrived as a steer into the running turn (same `turn_id` `…e64b3646`).
  - Injection on a steered prompt works too.

**QR, an idle TUI attached to its own app server**

The TUI ran with `codex --remote unix://<private socket>`, against `codex app-server --listen unix://…`.

- [FEATURE] PASS, attempt 2:
  - The setup turn ended at 17:33:04.
  - Ring at 17:33:27.396, with **plain `codex queue` (no `--remote`)**.
  - A new turn started at 17:33:36.876 (+9.5 s).
  - Pickup at +14.0 s.

  The same 9–10 s pickup as the embedded TUI: queued messages travel through the shared state store, whichever process hosts the thread.

**QB, ring during a turn (rerun, alone)**

- [FEATURE] PASS:
  - The long-command turn started at 17:36:28.
  - Ring at 17:36:40.681.
  - The message was **held until the running turn completed**: `Stop` at 17:37:16.156.
  - It then started **its own turn 36 ms later** (`UserPromptSubmit` with the pointer, new `turn_id`).
  - Pickup at +39.5 s.
  - No steer into the running turn and no duplicate.

**QD, ring after Esc (rerun, alone)**

- [FEATURE] PASS, matching the research:
  - Esc interrupted the long-command turn about 8 s in (no `Stop`).
  - Ring at 17:41:47.884: **no dispatch for 79 s**, through the end of the 75 s wait.
  - The human's "ok" at 17:43:07.146 ran as its own turn (`Stop` at 17:43:08.587).
  - Then the queued message started a new turn at 17:43:08.625, 38 ms later.
  - The rollout marks that turn `turn_attribution.turn_trigger: "queue"`. Typed turns are marked `"user"`.
  - The pickup itself was not observed: the model stalled again on that turn until the driver ended (17:45:37). Dispatch is proven by the turn start and the hook event; the pickup latency is unknown for this cell.

**C, a queued message during an epic-loop loop**

- [FEATURE] DEFERRED: it needs the human's approval for `danger-full-access` (sandbox-test D-7). Loop commits fail under `workspace-write`, and `writable_roots` does not lift the `.git` protection (section 0).
- Inference from QB: the queue waits for a running turn to complete. A Stop-hook chain continues the same turn, so a queued message would probably be held until the loop goes idle, not delivered between roles. That is unverified.
- Classification inference, unverified: the queued text arrives as a plain prompt in a new turn. If the loop is still running, epic-loop would see a new turn key while a role turn is open, which it treats as an aborted turn. After the loop is idle, it would be an ordinary message.

**Marker for queued turns**

- [FEATURE] OBSERVATION:
  - All 5 queued turns in the rollouts carry `turn_trigger: "queue"`, and all 15 typed turns carry `"user"`.
  - The hook logger did not record whether the `UserPromptSubmit` hook payload exposes this field; it keeps only selected fields. That is an open check for Phase 4. If the field is not exposed, a doorbell pointer needs its own recognizable prefix (as R8 proposes).

### 3. Archive and cleanup

- [SANDBOX] `driver/archive.sh` archived the six cell sandboxes to `artifacts/<cell>/`:
  - a git bundle, restore-tested for each cell;
  - `.doorbell/` and `.codex/`;
  - the cell's Codex rollouts, 8 files.

  It then removed each sandbox (`${VAR:?}` in every `rm -rf`).
- [SANDBOX] BUG (driver): QR's app server outlived its cell. `$!` was the Volta node shim, so `kill $!` left the real `codex app-server` running.
  - Killed by exact pid afterwards.
  - The driver now starts the app server with `setsid` and kills the process group. That fix is untested: no cell ran after it.
- [SANDBOX] No `sandbox-dbc`, `doorbell/kit` or `ptydrive` processes remain. `~/.codex/config.toml` has no sandbox entries.
- [SANDBOX] Left on purpose: the Codex rollouts in `~/.codex/sessions/2026/10/20/` and their threads in the state DB, which is normal history.

## Summary

- [FEATURE] Codex 0.162.0, terminal TUI, ring = `codex queue`:

  | Cell | Result |
  | --- | --- |
  | A idle (run 9) | works, new turn 10.1 s, pickup 13.6 s |
  | B mid-turn | held until the turn completes, then its own turn; pickup 39.5 s (ring 12 s into a 45 s command) |
  | C loop running | deferred: needs approval for `danger-full-access` |
  | D after Esc | not dispatched; dispatched right after the next completed turn (the human's message) |
  | E 15 min idle | works, 9.4 s / 13.4 s |
  | F closed, then resume | queue accepts it while closed; dispatched on its own at resume, about 3 s |
  | Remote app server | works, same 9.5 s pickup through plain `codex queue` |
  | Fallback (`UserPromptSubmit`) | works on Codex (injected into the next human message) |

- [FEATURE] Other facts:
  - The default `workspace-write` sandbox is enough for everything but loop commits.
  - No shared daemon is needed: the embedded TUI is reachable.
  - Queued turns are tagged `turn_trigger: "queue"` in the rollout.
- [SANDBOX]
  - Tokens: 730,750 in total over 8 Codex threads, under the 2 M budget:
    - QE 96 k;
    - QF 96 k;
    - FA 58 k;
    - QR 116 k;
    - QB 57 k + 155 k;
    - QD 57 k + 96 k.
  - A model stall during parallel cells cost two reruns. Run Codex cells one or two at a time.
  - A private app server needs a 0700 socket directory, and must be started with `setsid` so it can be killed.
