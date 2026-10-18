# Decision Log

## Active Decisions

- **D1 — The manager is the loop's single voice to the human** (2026-10-18).
  - The techlead no longer stops the loop directly: every transition to `idle` goes through a manager stop gate.
  - Why: techlead stops are often false, and techlead stop reports are technical dumps.
- **D2 — The stop gate challenges stops before accepting them** (2026-10-18).
  - It first asks whether the question is a blocker right now or can be deferred, and whether the work can be reorganized (another independent task, the question moved to the end of the phase or epic).
  - It must not push against stops that are clearly real. The exact boundary is Q1.
- **D3 — A justified stop gets a human-readable report from the manager** (2026-10-18).
  - The report is written in the user's terms, against the epic's original intent, goals and tasks: what was achieved, what is waiting for the human, what the human should decide. It is not a report of code changes.
  - It is presented as a review page.
- **D4 — The manager delegates page building and translation to subagents** (2026-10-18).
  - The page builder runs on the same model as the main session; the translator runs on a cheap model.
  - The main thread receives only the gate id, the URL and a few lines.
  - Translation and page building never run in the main thread.
- **D5 — One reusable engine with safe agent variability, not a fourth stack** (2026-10-18). Three layers:
  - **Engine-owned:** serving and its lifecycle, answer storage, the answer contract with `submittedAt`, autosave, theming, localization mechanics, lightbox, navigation, self-check.
  - **Block library:** text, decision card, answer controls, screenshot gallery, iframe, links, tables, diagrams, comparison viewers, before/after grids, code diff, a choice panel with presets and price axes.
  - **Agent custom blocks:** HTML/JS bound to the same answer contract, passing the same self-check. A custom block that is needed a second time moves into the library with a test.

  Fixed, card-only pages were rejected as too narrow: the agent must be able to express a request in proportion to the task.
- **D6 — Proportionality ladder** (2026-10-18).
  - (1) Short plain text for trivial yes/no.
  - (2) A page with cards and evidence.
  - (3) Interactive tools for comparison and choice.

  Product or design decisions are never asked as plain text. A choice with no visible and no cost difference is not asked at all.
- **D7 — Answers come back through a disk inbox and a per-platform doorbell** (2026-10-18).
  - Answers are written into the epic with `submittedAt`; the doorbell carries only a pointer.
  - Candidates: Claude Code `asyncRewake` hook, with background-task wake as the alternative; Codex `codex queue`.
  - Universal fallback: `UserPromptSubmit` injects pending answers on the human's next message.
- **D8 — The doorbell is proven by an early, separate verification gate** (2026-10-18). It covers platform × surface (terminal, VS Code, desktop app) × session state (idle, mid-turn, loop running, after Esc), before anything is built on it.
- **D9 — Localization** (2026-10-18).
  - English is always the first language.
  - The second language is never hardcoded; the agent chooses it from context.
  - Localization is a presentation layer only: docs and artifacts on disk stay English.
- **D10 — The epic viewer is a module separate from human gates**, shared by shaping and implementation (2026-10-18).
- **D11 — Pages open in the browser; no Electron** (2026-10-18). The CLI starts the server itself. A PWA install is an optional app-like window.
- **D12 — Local developer machine only** (2026-10-18). Remote or cloud sessions are out of scope for now.
- **D13 — The npm CLI serves; the skill decides; the agent authors** (2026-10-18).
  - The engine, server, renderer and viewer live in the npm CLI (dependencies allowed).
  - The skill keeps role rules and loop-state transitions (Node built-ins only).
  - Agents author content and custom blocks.
- **D14 — Everything works on Claude Code and Codex** (2026-10-18).
- **D15 — Upcoming architecture changes are not built for here** (2026-10-18).
  - Engineer turns as per-turn subagents, and phases running in parallel worktrees under a central orchestrator session, are separate epics.
  - This epic records them, avoids decisions that contradict them, and expects its layer to be adapted in those epics.

- **D16 — Stop-gate classes and rules** (2026-10-18; resolves Q1). Based on about 60 past techlead stops across 36 epic logs.
  - **Stop classes:**
    - **A, done:** a phase or the epic is complete.
    - **B, needs the human's hands or authority:** publish, release, an upgrade outside the repo, sign-in, an attended browser session, explicit authorization.
    - **C, a decision with a reasonable default.**
    - **D, environment friction:** a busy port, foreign resources, a flaky tool.
    - **E, ordering or bookkeeping.**
    - **F, a product decision with no default.**
  - **The flow:**
    - The techlead never sets `idle` itself; it sends the manager a stop request with a class.
    - A is never challenged.
    - B and F: the loop keeps doing work that does not depend on the item. The item goes to the human queue. The loop stops only when no independent work is left.
    - C: the techlead takes the recommended default, and the loop continues (D17).
    - D: find a workaround or defer the verification and continue. Stop only when nothing else is left.
    - E: never a stop; reorder or fix the bookkeeping.
  - **Limits:** at most one challenge round, and the manager never overrides A, B or F. Every gate outcome (challenged and continued, or accepted) is logged so the boundary can be tuned (R2).
  - **When the human queue is shown:** at any justified stop, in one report; at a phase boundary when an item affects the next phase; and at the epic end.
- **D17 — Class C decisions are recorded as taken decisions, flagged as made by the agent** (2026-10-18).
  - They are not "pending": the loop builds on them.
  - They appear in the final (or stop) report as a list for the human to confirm or reverse.
  - The epic viewer shows them prominently while the epic runs, so the human can react early (Phase 5).

- **D18 — The stop gate ships first and alone** (2026-10-18).
  - Phase 1 (stop gate, agent-made decisions, human queue, text stop reports) does not depend on the visual layer and is needed sooner.
  - It is built on its own branch from `main` and merged into `main` before the other phases.
  - Phases 2–6 are built in a separate worktree branched from `main` after that merge.

- **D19 — Doorbell spike scope** (2026-10-18).
  - Terminal CLI only, on Claude Code and Codex.
  - The VS Code extensions use the same mechanics; the user checks them by hand later and reports bugs.
  - GUI surfaces (desktop apps) are out of scope for now.
  - The long-wait case is 15 minutes.
  - Claude Code channels are skipped: research preview, and they need a launch-time flag on every session. They stay a watch item.

- **D20 — Pages are agent-written HTML with the engine's web components** (2026-10-18; resolves Q4).
  - The engine ships custom elements (answer controls, screenshots with lightbox, iframes, tables, diagrams, comparison viewers) and a runtime that owns answers, lightbox, i18n, theming and navigation.
  - The agent writes plain HTML and mixes its own markup with the components. A custom block (own JS) is allowed if it writes answers through the engine's API.
  - The answer schema is derived from the controls' `name`s by the check.
  - Text is authored in English only. The check extracts text segments; the translator subagent writes `i18n/<lang>.json`; the runtime swaps text.
  - No build step.
- **D21 — Static check only, plus an always-working "report a problem" button** (2026-10-18).
  - The check is static and simple: unique control names, evidence files exist, translations complete, no forbidden constructs.
  - No headless browser check.
  - The engine injects a "something is wrong with this page" button, isolated from the page's own code so it works even when the agent-written part is broken. A report is stored like an answer and rings the doorbell, so the page gets fixed.

- **D22 — Terms: "answers" vs "inbox"** (2026-10-18).
  - *Answers* are the human's answers on review pages. The *inbox* is the human's requests and change asks sent while the loop runs.
  - Both travel the same way: a file on disk, checked at every role transition, with the doorbell for an idle session. They differ in what happens next.
- **D23 — The manager records, the techlead plans** (2026-10-18).
  - The manager records the human's input into the artifacts: decisions into `decision-log.md`, resolved human-queue items, confirmed or reversed agent-made decisions. It leaves the techlead a short "what changed" note.
  - Only the techlead plans: follow-up tasks, rework after a reversed decision, reordering.
- **D24 — The human-facing side is one app with routes** (2026-10-18).
  - The home page is the epic overview. Reviews, reports, decisions, docs and progress are routes reached from it.
  - Pending non-blocking reviews show on the home page as notifications with a count.
  - The manager gives a deep link to the exact page in chat.
  - Phase 3 builds the app shell: home with pending reviews, plus review routes. Phase 5 grows the home page into the full epic overview.
- **D25 — Auto-continue after a stop report** (2026-10-18). A stop-report page has a "continue after submit" switch, on by default. When the submitted answers unblock work, the loop resumes on its own. With the switch off, the answers are recorded and the loop stays paused.
- **D26 — Human-wait statuses, hold kinds and ids** (2026-10-18).
  - **The `on-hold` task status** is new. It requires `Hold: <kind> (H<n>)` on the task. `blocked` stays only for technical blockers the agent cannot remove.
  - **Kinds:**
    - `checkpoint`: planned in shaping, to show or agree something.
    - `costly-decision`: expensive to reverse. Shown with options and a price; blocks only the dependent path.
    - `security-hold`: a guard stopped a dangerous operation. Never auto-resolved; shows the exact command and needs explicit confirmation.
    - `human-action`: needs the human's hands (publish, sign-in, upgrade, an attended session). Gives steps and a "done" control.
    - `product-decision`: a direction with no reasonable default.
    - `external-wait`: an outside event, not the human. A notification only; the loop rechecks the condition.
  - **Ids:** `H<n>` is the stable id of a human-queue item, alongside `D<n>` for decisions. One review page may cover several H items.
  - **Mapping to D16 classes:** B → `human-action` / `security-hold`; F → `product-decision`; an irreversible C → `costly-decision`.
  - This ships in Phase 1.

- **D27 — Stable ids everywhere, canonical without a hyphen** (2026-10-18; resolves Q7).
  - Tasks get `T<n>` ids in `tracker.md`, a tracker format and script change, with existing epics migrated.
  - Decisions are `D<n>`, human-queue items `H<n>`, risks `R<n>`, open questions `Q<n>`.
  - The canonical form has no hyphen (`D16`). The viewer also understands `D-16`.
- **D28 — Docs translation in the viewer** (2026-10-18; resolves Q5).
  - When the human switches language, the server starts a background headless process on a cheap model; it never runs in an agent session.
  - The cache is keyed by content hash under `.runtime/`.
  - The manager chooses the second language from the conversation language and writes it into the epic config (D9).
- **D29 — Discussing the epic without interrupting the loop is its own phase** (2026-10-18; Phase 6).
  - A chat panel in the app is backed by a separate read-only agent session that sees the epic artifacts and the loop activity.
  - A "send to inbox" control passes a resulting change to the loop, which picks it up at the next role transition.
  - Shaping tools move to Phase 7.
- **D30 — Design direction for the app and every page** (2026-10-18).
  - Elegant, minimal and well thought through. Avoid design clichés and the typical SaaS / AI look.
  - A restrained TUI-inspired feel is welcome as a direction, not a requirement.
  - Dark and light themes ship from the start, chosen automatically from the OS (`prefers-color-scheme`).
  - The design is made with a design skill (design system first), and verification includes a design critique and an accessibility review.
- **D31 — Status scripts edit tracker.md in place; tracker.md is the source of truth** (2026-10-18; agent-made, stop class C; unconfirmed).
  - Default taken: Task and phase scripts re-import roadmap state from tracker.md on every call and patch only the lines they change (status token, checkbox, phase status, Hold line); render-tracker stays an explicit full re-render
  - Why: Today every task/phase script re-renders tracker.md from a stale .runtime/roadmap-state.json and drops hand-written detail (nested outcomes, Method/Evidence, phase Intent, intro text, later hand edits); the on-hold status needs a Hold line that survives, and SKILL.md already names tracker.md the source of truth
- **D32 — The manager commits each accepted stop's report** (2026-10-18; agent-made, stop class C; unconfirmed).
  - Default taken: After review-stop accepts, the manager commits the saved stop report together with the human-queue and decision-log changes of that review, as 'docs(epic): stop report NN (class X)'; it is the loop's message to the human, not housekeeping
  - Why: Sandbox run 5: an accepted stop left stop-reports/NN and queue changes uncommitted; the final report of an epic stayed uncommitted for good

- **D33 — Phase 1 merges even if the Codex check fails; Codex becomes tech debt** (2026-10-18; Oleg).
  - The Codex half of the Phase 1 verification is one minimal mechanics run (run 8: 3 tasks, one session, low reasoning effort, no user config, a 14-turn watchdog), not the full Claude scenario.
  - If it cannot be completed, Phase 1 is merged anyway and the Codex verification is recorded as tech debt.
  - Why: run 7 used the whole Codex quota (11.3 M tokens) on the full 9-task scenario; Codex only needs the role mechanics checked.

## Open Questions

- **Q1 — Stop-gate boundary.** Resolved by D16 and D17.
- **Q2 — Doorbell results.** Which platform, surface and session-state combinations get an autonomous return, and which rely on the fallback? This is answered by the D8 gate.
- **Q3 — Arrival while busy.** Resolved for the design by Phase 4: answers on disk are checked at every role transition, so a running loop picks them up itself; the doorbell only wakes an idle session. The Phase 2 matrix confirms the platform behaviour.
- **Q4 — Page authoring format.** Resolved by D20.
- **Q5 — Translation backend.** Resolved: review pages by the translator subagent (D4), viewer docs by a background process (D28).
- **Q6 — Viewer live activity.** Resolved: the activity comes from the driver session's transcript tail, with no model involved (Phase 5); the discussion is Phase 6 (D29).
- **Q7 — Stable references.** Resolved by D27.
- **Q8 — Shaping tools.** Phase 7 (D29). Whether it stays in this epic is decided after Phase 5.
- **Q9 — Order and MVP.** Resolved by D18 and the phase order in `tracker.md`.

- **Q10 — Subagents on Codex.** How does a Codex manager invoke a subagent on a cheaper model for translation? Confirm while building the subagent task in Phase 3.

## Historical Decisions

- None recorded yet.
