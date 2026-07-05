# State Of Epic

Epic: Epic-Loop Mode Reminder And Session Unbind
Slug: `mode-reminder`
Created: 2026-07-04T19:18:09+00:00
Current mode: shaping
Active phase: Phase 2 - Design The Solution And Write A Proposal
Active task: TBD

## Current State

- Initial shaping is done: problem framing, scope, risks, and the full 6-phase roadmap are captured in `docs/problem-framing.md`, `decision-log.md`, `risk-register.md`, and `tracker.md`.
- Phase 1 (Shape The Epic) is closed.
- The feature has two parts: (1) a per-turn `UserPromptSubmit` mode-reminder injection via `hookSpecificOutput.additionalContext` for shaping/review-bound sessions, and (2) a new `unbind-session.mjs` script that lets the current session detach from its epic on user intent.
- Codex parity for `additionalContext` is currently based on documentation research (`developers.openai.com/codex/hooks`) only — not yet proven with a real POC. Phase 3 exists specifically to close that gap before implementation.
- The unbind trigger phrase/intent rule is intentionally undecided; Phase 4 is where it gets designed and wired into `SKILL.md`.

## Blockers

- None recorded.

## Next Action

- Start Phase 2: design the mode-reminder hook change and the `unbind-session.mjs` script, and write up a concrete proposal per the task's acceptance criteria in `tracker.md`.
