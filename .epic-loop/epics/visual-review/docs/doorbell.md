# Doorbell (Phase 2)

How a waiting session picks up the human's answers without a chat message. Decisions: D7, D8, D19.

## Contract

- Answers are written into the epic with `submittedAt`; that file is the source of truth.
- The doorbell carries only a short pointer to the file.
- Fallback on every platform: `UserPromptSubmit` injects pending answers on the human's next message, whatever its text.

## Candidates

See `prior-art.md`, "Doorbell research".
- Claude Code: `asyncRewake` hook (event-triggered or session-long waiter), `run_in_background` waiter.
- Codex: `codex queue`; `app-server` `turn/start` only as an alternative.

## Probe Kit And Smoke Results (2026-10-19)

- Kit: `.claude/skills/sandbox-test/tools/doorbell/`. Its README describes the parts: installer, answers server, waiters, fallback, hook logger, pickup, latency summary.
- Smoke run (one idle session per mechanism): `.claude/skills/sandbox-test/runs/2026-10-19-doorbell-smoke/log.md`.

| Mechanism | Ring → first hook | Ring → pickup | Notes |
| --- | --- | --- | --- |
| Claude Code `asyncRewake` (event, on `Stop`) | 168 ms | 3.8 s | The pointer reaches the model in the rewake body |
| Claude Code `run_in_background` waiter | 63 ms | 5.1 s | The notification has no stdout; the pointer came from the fallback injection |
| Codex `codex queue` (idle TUI) | 10.1 s | 13.6 s | Default sandbox is enough; the watcher delay is about 10 s |

Facts the matrix and the design must account for:

- **Claude Code wakes arrive as a `UserPromptSubmit` event.** Both the `asyncRewake` exit 2 and a finished background task do this, and the event's `prompt` is the `<task-notification>` XML.
  - The `asyncRewake` body is `Stop hook blocking error from command "<name>": <stderr>`, unless the undocumented `rewakeMessage` sets another prefix.
  - The woken turn's `Stop` has `stop_hook_active: true`.
- **asyncRewake timeout.** The hook `timeout` also bounds async and asyncRewake hooks; the default is 600 s, after which the hook is killed. Claude Code kills its async hook processes when it exits.
- **The Codex queued message arrives as a plain user prompt** (`UserPromptSubmit` with the pointer text and a new `turn_id`). Nothing marks it as coming from the queue.
- **Open:** whether the asyncRewake `timeout` has an upper cap, and whether the rewake stderr has a size limit.

## Matrix

### Claude Code 2.1.293, terminal (interactive TUI)

Run log: `.claude/skills/sandbox-test/runs/2026-10-19-doorbell-claude-matrix/log.md` (run 10). Idle cells 1A and 3A come from run 9 (`2026-10-19-doorbell-smoke`).

Latency is submit → pickup. "New turn" means a new host turn (new `prompt_id`). "Same turn" means the wake is queued and delivered in the running turn right after its current tool call ends.

| Mechanism | A idle | B mid-turn | C loop running | D after Esc | E 15 min idle | F closed, then `--resume` |
| --- | --- | --- | --- | --- | --- | --- |
| 1 `asyncRewake` hook on `Stop` | works, new turn, 3.8 s | works, same turn, 41 s | works, same turn, 30 s | works, new turn, 5.2 s | works with `timeout` 86400 (4.4 s); does not with the default timeout | does not |
| 2 `asyncRewake` hook on `SessionStart` | works, new turn, 4.3 s | works, same turn, 37 s | n/a (see note) | works, new turn, 10.4 s | works with `timeout` 86400 (3.9 s) | works, 11.3 s |
| 3 `run_in_background` waiter | works, new turn, 5.1 s | works, same turn, 36 s | works, same turn, 32 s | works, new turn, 3.5 s | works, 12.6 s | does not |
| 4 `UserPromptSubmit` fallback | next human message | next human message | n/a (see note) | next human message | next human message | first human message after resume |

Notes:

- **Where the pointer comes from.**
  - Rows 1–2: the asyncRewake exit-2 body (`Stop hook blocking error from command "<name>": <stderr>`) arrives as a `UserPromptSubmit` whose prompt is `<task-notification>` XML plus a system reminder.
  - Row 3: the notification has only the task id and output-file path. The model reads the waiter's output file, which works without any instruction beyond "read the doorbell task's output".
  - Row 4: `additionalContext` on the human's message.
- **The asyncRewake timeout.** The default is exactly 600 s: Claude Code SIGTERMed the hook at 600,001 ms, after which a ring wakes nothing. A waiter must set `timeout` explicitly. No upper cap was hit at 86400 s over 15 min.
- **The rewake body size.** A 20 KB stderr body reached the model untruncated. Larger sizes were not tested.
- **Esc and close.**
  - Esc fires no `Stop`, and armed waiters (hook processes and background tasks) survive it.
  - Closing the session SIGTERMs every waiter, and background tasks are not restored on resume.
  - Only a `SessionStart` hook re-arms on resume (`source: resume`). It fires at once when answers are pending.
- **The event-armed waiter (row 1) re-arms on every `Stop`, including every Stop-hook block of an epic-loop chain.** A lock keeps one waiter. While the session idles, nothing re-arms a waiter that died.
- **epic-loop classification (state C, rows 1 and 3).**
  - The wake is logged as `synthetic-prompt-ignored` (`harness-injected-prompt`, `turn_key_adopted: false`).
  - The engineer turn stays open, and the loop chains normally to `idle`, with no abort, stop, or lost `next_role`.
  - The whole loop is one host turn (one `prompt_id`), so the synthetic check is what keeps the wake from being read as a user message. **No misclassification was found.**
- **n/a cells.**
  - 2C was not run. It uses the same asyncRewake delivery path as 1C and differs only in when it is armed, and it is one-shot per session.
  - 4C needs a human message during the loop, which is epic-loop's documented `user-message-in-turn` path, not a doorbell.
- **Hidden tool calls.** Claude Code sometimes fires a `PreToolUse` hook about 2–5 s after a `Stop` for a speculative next command that never appears in the transcript. A future `PreToolUse` hook must tolerate it.

### Codex 0.162.0, terminal (interactive TUI)

Run log: `.claude/skills/sandbox-test/runs/2026-10-20-doorbell-codex-matrix/log.md` (run 11). Idle cell A comes from run 9.

The ring is `codex queue --thread <id> --message <pointer>`. It exits 0 in about 0.2 s and prints `Queued message <id> for thread <id>`. The thread id comes from `CODEX_THREAD_ID`, which the session registers. Latency is submit → pickup.

| Mechanism | A idle | B mid-turn | C loop running | D after Esc | E 15 min idle | F closed, then `codex resume` |
| --- | --- | --- | --- | --- | --- | --- |
| `codex queue` | works, new turn, 13.6 s | works, held until the turn completes, then its own turn, 39.5 s | deferred (see note) | not dispatched until the next completed turn | works, 13.4 s | works: queued while closed, dispatched on resume, about 3 s after resume |
| `UserPromptSubmit` fallback | next human message | next human message | n/a | next human message | next human message | next human message |

Notes:

- **How a queued message arrives.**
  - It arrives as a plain user prompt in a new turn (`UserPromptSubmit` whose prompt is exactly the pointer).
  - The TUI picks it up about 9–10 s after the queue call (the state-store watcher).
  - It never steers into a running turn. It starts its own turn about 40 ms after the running turn's `Stop`.
  - The rollout marks such turns `turn_attribution.turn_trigger: "queue"`. Typed turns are marked `"user"`. Whether the hook payload exposes that field is not yet checked; until then, a hook can tell a queued pointer from a typed message only by its text.
- **After Esc.** No auto-dispatch: 79 s of silence in the run. The next completed turn releases the queue, so the human's next message runs first and the pointer turn follows immediately. This matches the research.
- **Closed thread.** `codex queue` accepts a message for a thread that is not loaded, and `codex resume` dispatches it right after `SessionStart` (`source: resume`).
- **Daemon vs embedded.**
  - No shared app-server daemon runs on this machine, so the plain TUI is embedded, and `codex queue` reaches it without a socket.
  - A TUI attached through `--remote unix://…` to its own `codex app-server` behaves the same: 9.5 s, plain `codex queue`.
  - The shared daemon was not started, because that would be a machine-wide side effect.
- **Version and sandbox.**
  - `codex queue` is present in 0.162.0. The research says it has been stable since 0.149; the minimum version was not re-tested.
  - The default `workspace-write` sandbox with `-a never` is enough for the session side (registering the thread, the pickup).
  - Loop commits are not possible under `workspace-write`: `.git` stays read-only even with `sandbox_workspace_write.writable_roots`.
- **The fallback** works on Codex: `additionalContext` on the next human message, including a message steered into a running turn.
- **C deferred.** It needs the human's approval for a `danger-full-access` sandbox run (sandbox-test D-7). Inference from cell B, unverified:
  - A Stop-hook chain continues one turn, so a queued message is likely held until the loop goes idle.
  - If it ever arrives while a role turn is open, epic-loop would see a new turn key and treat it as an aborted turn (`implementation-cycle.md`).


## Choice

### Claude Code (proposal, 2026-10-20, awaiting the human's confirmation)

Evidence: the Claude Code matrix above (run 10) and the end-to-end run `.claude/skills/sandbox-test/runs/2026-10-20-doorbell-claude-e2e/log.md` (run 12).

**Recommended: an epic-loop-installed `asyncRewake` waiter hook, armed on `Stop` and on `SessionStart`, with an explicit `timeout`. It is active only while the epic has an open blocking gate (loop status `awaiting-review`).** The fallback covers what the hook cannot reach.

Why this fits `human-gates.md`:

- **A blocking gate leaves the session idle,** and only a hook can wake an idle session without a role.
  - Run 12 E3: the session idled after an accepted class B stop. The submit woke it in 0.2 s, and the loop came back with no human message.
  - A role-held background waiter (E1) also works, but it keeps a role turn open. It cannot serve a manager-opened gate that ends the loop turn.
- **It covers every terminal state that matters (run 10):**
  - idle: about 4 s;
  - mid-turn: delivered in the same turn after the running tool call, with no duplicate;
  - after Esc: waiters survive it;
  - 15 min idle: works, given an explicit `timeout`;
  - resume: the `SessionStart` hook (`source: resume`) re-arms and fires at once when answers are pending.

  The `Stop` hook alone misses resume, because a resume fires no `Stop`. The `SessionStart` hook alone is one-shot per session.
- **epic-loop already tolerates it.** During a running loop, a wake is `synthetic-prompt-ignored`, and the loop keeps chaining (run 10, cells 1C and 3C).
- **The rewake body carries the pointer.** 20 KB is delivered untruncated. The undocumented `rewakeMessage` option can set a recognisable prefix.

Keep the role's background waiter (run 12 E1) as the pattern for a **role-level** wait. This is when a role itself must wait for something it started: `turn-waiting-background` holds the role turn, and the notification resumes it (3.3 s ring → pickup).

**Fallback rules:**

- `UserPromptSubmit` injects the pending-answers pointer on the next human message, whatever its text. It works inside a loop too: run 12 E2 logged `user-message-in-turn`, and the pointer reached the techlead.
- **The fallback alone never holds a gate.** With no waiter, a role that "waits" ends its turn and the loop moves on (E2). So gates must use the hook waiter. The fallback only covers what the hook cannot reach:
  - a session closed and resumed in a host without hook support;
  - a waiter killed by an expired `timeout`;
  - surfaces not yet verified (VS Code extension, desktop app).
- The answers page says "send any message to continue" when no doorbell is available.

**Product changes for Phase 4:**

- **Gate state on disk.** A blocking gate sets the loop status to `awaiting-review` (not `idle`), with the gate id and its answers file. The waiter hook exits at once (exit 0) unless such a gate is open, so it costs nothing otherwise.
- **Hook install.** `install-hooks.mjs` adds the waiter entries: `Stop` and `SessionStart`, with `asyncRewake: true` and an explicit `timeout`, for example 86400. A lock keeps a single waiter, because the `Stop` hook fires on every Stop-hook block of a loop chain.
- **A marker on the wake prompt.** Set `rewakeMessage` (for example `[epic-loop doorbell] gate <id>:`), so the `UserPromptSubmit` hook can tell a doorbell wake from other task notifications.
- **Deterministic auto-continue.** When the `UserPromptSubmit` hook sees that marker while the loop is `awaiting-review`, it resumes the loop itself: driver binding, then manager ingest. In E3 the model did it with `bind-session.mjs`, but only because the prompt told it to; the skill's own rule is "resume only on request".
- **Logging.** epic-loop logs nothing for a wake while the loop is not running (E3). Add an `answers-submitted` / `doorbell-wake` progress event.
- **Stop acceptance input.** `review-stop.mjs --outcome accepted` needs the report on stdin. Under a no-redirection command policy the manager cannot accept, and the loop stalls at `next-role-not-set` (E1 and E2). Add `--file` (or an argument form), and keep an unresolved stop review from looping.

**Doctor checks:**

- every epic-loop asyncRewake hook has an explicit `timeout`, because the default 600 s kills the waiter;
- a warning that `asyncRewake` is backgrounded only in interactive sessions, so a headless `claude -p` driver relies on the fallback;
- the Claude Code version is at least 2.1.293, the version these results come from (lower bound not tested).

### Codex

On hold (H3): the end-to-end Codex run needs a `danger-full-access` sandbox run. The Codex matrix above already shows `codex queue` delivering in every state except after Esc (where the queue waits for the next completed turn) and a running loop (untested).
