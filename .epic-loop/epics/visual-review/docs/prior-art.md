# Prior Art And Research Findings

Collected 2026-10-17/18 while shaping. Paths are on the user's machine.

## Review-page stacks the user built

Three separate stacks grew side by side and share no code.

### 1. RND feedback kit (most reusable)

- Skill: `/projects/focus-reactive/rnd-workspace/RND/.claude/skills/review-page/SKILL.md`, plus `assets/template-builder.ts`.
- Kit: `RND/harness/feedback/kit/` (`kit.ts` for the build side, `kit.js` for the browser side, `kit.css`).
- Server: `RND/harness/feedback/index.ts` (`pnpm rnd feedback <dir> --page <file>`, port 4310).
- Policy: RND `CLAUDE.md`, "Oleg's time comes first".
- **How it works.** A builder script written per page imports the kit and emits one static HTML file. The server serves the folder and stores whatever a page PUTs to `/api/feedback/<name>` as `<dir>/feedback/<name>.json`, written atomically, with autosave and a visible save status. The agent reads the file after the human says "done" in chat.
- **Primitives:** `choices` (with the recommended option marked), `checkbox`, `comment`, `shot`, `pageShell`, en/ru text with build-time failure on a missing translation, a lightbox, nav dots (green when the answer matches the recommended one, amber otherwise).
- **Clever:** the lightbox moves the card's own caption and answer controls into the popup's side panel and back on close, so an answer given in the popup is the page's own control, with no duplicate state.
- **Fragile:**
  - each builder repeats the same page-script boilerplate;
  - the answer shape has no schema;
  - completion exists only as "done" in chat;
  - foreground server with hand-picked ports;
  - two tabs on one page overwrite each other's state;
  - no live reload.
- **Example from a live run:** `RND/evals/backlog/T0/2026-10-17/combined/build-review.ts` produced `review/clones.html`. It has one overall question and one card per project; each card has live links, a "what is ours" list, a before/after table and screenshots in the lightbox.

### 2. design-research overlay (most expressive)

- `/projects/focus-reactive/ywh-workspace/design-research/preview/overlay/apps/sanity/src/app/(dr)/dr/`. These are Next routes installed into the target app: `map`, `forks`, `compare`, `digest`, `regression`.
- **Forks page.**
  - Every implementation choice with a visible or cost difference is shown live: an iframe of the component with the picks applied, next to the target design.
  - Modes: side by side, overlay with an opacity slider, difference blend. Widths 1440/768/375.
  - Each option carries a "pole" and a price on two axes: difference from the target, and divergence in code.
  - Presets: "All as Figma", "All reuse", "Agent's picks", "My mix".
  - "Confirm" sets `confirmedAt` and appends to `forks-log.jsonl` with `followedRecommendation`. 13 of 14 recommendations were followed, and repeated choices are meant to become rules.
- **Rule:** never ask about a fork as text. A choice with no visible and no cost difference is not a fork; the agent decides it itself.
- **Check-request discipline:** what to check, how (URL and clicks), what is compared with what, and why.
- **Rejected:** a text-heavy digest page. It asked the human to judge text again.

### 3. RND section-learn (safest)

- `RND/.claude/skills/section-learn/SKILL.md`, `RND/harness/section/learn.ts`.
- The agent writes declarative `proposals.json`, `section learn check` validates it (ids, allowed values, complete translations, every source cited), and a generic builder renders the page.

## Doorbell research: returning answers to a waiting session

Done from docs and source on 2026-10-18. None of this is verified by a live run yet (see D8).

- **Claude Code**
  - **`asyncRewake: true` on a command hook:** the hook runs in the background, and exit code 2 "wakes Claude immediately even when the session is idle". stderr is shown as a system reminder. Documented, no preview label.
    - Unconfirmed: the default timeout and its units, any stderr length limit, and behaviour in the VS Code extension and the desktop app.
  - **Background Bash (`run_in_background`):** a `<task-notification>` arrives when the task exits. The docs do not state that it wakes an idle interactive session, but this was observed live (epic-loop sandbox run 4, `turn-waiting-background`; and the VS Code extension session of 2026-10-17).
    - Tasks die when Claude Code exits and are not restored on resume. They may be stopped under memory pressure after 30 minutes idle.
  - **Monitor:** 30 minutes per watch at most, then it must be re-armed.
  - **Channels** (an MCP server pushing `notifications/claude/channel`): the intended design for external events. It is a research preview, needs a launch-time flag, and is not available on Bedrock, Vertex or Foundry.
  - **Not usable:** `claude -p --resume` against an open session (transcripts interleave). Plain `async` hooks also do not work: their output waits for the next user turn.
- **Codex**
  - **`codex queue --thread <id> --message "<text>"`** (stable since 0.149): it stores a durable user message, wakes an idle loaded thread, and starts a turn tagged `queue`. While a turn runs, it waits for that turn to complete.
    - Messages written by other processes are picked up within about 10 s (an SQLite watcher).
    - The thread id is `CODEX_THREAD_ID` in shell commands.
    - Threads whose last turn was interrupted (Esc) are not auto-dispatched.
    - IDE extension and desktop app: unconfirmed.
  - **Not usable:**
    - Hooks cannot start a turn later: async hooks wait for the next user turn.
    - A background process finishing does not start a turn.
    - MCP notifications are only logged.
    - `exec resume` against an open TUI is blocked by the writer lock.
  - **Alternative:** an app-server client doing `thread/resume` and then `turn/start` on the shared daemon. The surface is labelled experimental.
- **Universal fallback:** `UserPromptSubmit` injects pending answers on the human's next message, whatever its text, and the page says "send any message to continue".

## Live-run evidence (2026-10-17, another project's epic)

- Validation page built by an engineer turn, served on 4310. The techlead set `idle` with the URL in the reason, and `tracker.md` got the invented status `waiting-for-oleg`.
- A 90-minute engineer turn on an open-ended brief ran with no checkpoint until the human stopped the loop (epic-loop issue #12).
