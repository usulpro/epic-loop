# Epic Problem Framing

## Problem

Epic-loop talks to the human badly, and the human answers it badly.

- **False stops.** The techlead often stops the loop (`idle`) because it believes it is blocked or needs an answer. Asked "is this a blocker right now, or can it wait until the end of the epic?", it usually answers that it could continue. Today the human has to ask that question.
- **Unreadable stop reports.** When the loop stops, the techlead's last message is a technical state dump (files, code changes). It does not say what was achieved relative to the epic's intent, what is waiting for the human, or what the human should decide. The human has to ask follow-up questions and request a human-readable summary.
- **Walls of text.** Questions, decisions and reports arrive as one long chat message. The human cannot answer part by part, cannot see the evidence behind a decision, and has to dig through files to understand references such as "per D16".
- **No first-class "waiting for the human" state.** In a live run (2026-10-17, another project), the loop stopped with `next_role=idle` and a URL in the reason. The engineer wrote a status `waiting-for-oleg` that does not exist in `TASK_STATUSES` by hand into `tracker.md`. Nothing brings the human's answers back into the loop: the human must write "read my answers" in chat and resume the loop manually.
- **No view of the epic.** Phases, tasks, decisions, docs and live progress exist only as markdown and runtime logs on disk. The human cannot see at a glance where the epic is, what the agent is doing now, or read the epic in their own language.

The user already works this way in other projects (static review pages with a feedback server, interactive decision pages). Those tools were built per project, in three separate stacks that share no code (see `prior-art.md`).

## Desired Outcome

1. **The manager is the loop's single voice to the human.**
   - Every stop of the implementation loop passes through a manager stop gate.
   - The gate challenges stops that are not real blockers: it defers questions, or reorganizes work so the loop continues.
   - When a stop is justified, the manager produces a human-readable report written against the epic's original intent, goals and tasks, not against the technical state.
2. **Visual, interactive human gates.**
   - Questions, decisions and reports are presented as local web pages, proportionate to the task: from short plain text up to interactive comparison tools.
   - The human answers on the page, part by part. Answers land in the epic on disk.
   - The waiting session picks the answers up on its own, without the human typing "read my answers".
3. **A reusable engine.**
   - Everything that can break, or that every page needs, is ready and tested: serving, answer storage, the answer contract, lightbox, localization mechanics, theming, self-check.
   - Agents keep safe freedom to compose each page for the task at hand.
4. **An epic viewer** for shaping and implementation:
   - phases and tasks;
   - presentation-layer localization;
   - docs browsing with working links;
   - expansion of references (decisions, tasks, risks);
   - live progress, including what the agent is doing now.

## Scope

- Manager stop gate and human-readable stop reports in the implementation loop.
- Review-page engine: server, kit, building blocks, answer contract, self-check. The engine is served by the npm CLI.
- Page building and translation delegated by the manager to subagents.
- Human gates as a loop state, with the answers inbox, ingestion and an autonomous return to the session ("doorbell") on Claude Code and Codex.
- Epic viewer module, shared by shaping and implementation.
- An early verification gate that proves the doorbell technique across platforms, surfaces and session states before anything is built on it.

## Non-Scope

- Remote, cloud or web sessions. Epic-loop is a developer tool on the local machine (D12).
- A desktop app shell such as Electron (D11).
- Running engineer turns as subagents, and running phases in parallel worktrees. Both are planned as separate epics; this epic records them as known upcoming changes and avoids decisions that contradict them, but does not build for them (D15).
- Design-specific tooling from prior art (Figma overlays, pixel diff modes) as part of the core engine.

## Constraints

- Works on both Claude Code and Codex (D14).
- Skill scripts stay Node built-ins only. Servers, renderers and other dependency-heavy parts live in the npm CLI (D13).
- Generated artifacts and docs on disk stay English. Other languages exist only in the presentation layer (D9).
- Translation and page building never run in the main thread (D4).
- Keep it semi-manual where possible: build more only when a real, repeated need shows up.

## Open Questions

See `decision-log.md`, "Open Questions" (Q1–Q9).
