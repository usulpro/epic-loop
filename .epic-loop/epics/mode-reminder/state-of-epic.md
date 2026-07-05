# State Of Epic

Epic: Epic-Loop Mode Reminder And Session Unbind
Slug: `mode-reminder`
Created: 2026-07-04T19:18:09+00:00
Current mode: implementation
Active phase: Phase 3 - Validate With Real Proofs Of Concept On Codex And Claude Code
Active task: Phase 3 Task 3 - Prove, with a real running Claude Code session, that the same `hookSpecificOutput.additionalContext` mechanism works, and capture how Claude Code actually renders it

## Current State

- Initial shaping is done: problem framing, scope, risks, and the full 6-phase roadmap are captured in `docs/problem-framing.md`, `decision-log.md`, `risk-register.md`, and `tracker.md`.
- Phase 1 (Shape The Epic) is closed.
- Phase 2 (Design The Solution And Write A Proposal) is closed. The concrete proposal lives in `docs/mode-reminder-design.md`: a new `buildModeReminder(payload, binding)` in `lib/hooks.mjs`, sourced only from `binding.mode` (no extra reads), fires on `UserPromptSubmit` for bound `shaping`/`review` sessions only; `handleHook` composes it with the existing Stop-hook continuation via a single `??` fallback since the two are mutually exclusive by construction. `unbind-session.mjs`'s CLI shape, behavior, and additive `deactivated_reason` field are also fixed. See `decision-log.md` for the accepted decisions.
- The feature still has two parts: (1) the per-turn `UserPromptSubmit` mode-reminder injection via `hookSpecificOutput.additionalContext` for shaping/review-bound sessions, and (2) the new `unbind-session.mjs` script that lets the current session detach from its epic on user intent.
- Codex parity for `additionalContext` is now proven for the interactive Codex CLI/TUI path in a trusted project. The POC used a temporary `UserPromptSubmit` hook and token `POC-CODEX-ADDITIONAL-CONTEXT-TRUSTED-1783273589-8273`; Codex visibly rendered `UserPromptSubmit hook (completed)` plus `hook context: ...8273`, and the model returned the exact token. Claude Code still needs its own real POC before implementation.
- The unbind trigger phrase/intent rule is intentionally undecided; Phase 4 is where it gets designed and wired into `SKILL.md`.

## Blockers

- None recorded.

## Next Action

- The platform-switch handoff happened: `mode-reminder` is now resumed in a real Claude Code session (2026-07-06). Run the Claude Code `additionalContext` POC next; do not treat the Codex proof as a substitute for Claude Code evidence.
