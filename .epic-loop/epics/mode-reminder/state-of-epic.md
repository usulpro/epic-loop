# State Of Epic

Epic: Epic-Loop Mode Reminder And Session Unbind
Slug: `mode-reminder`
Created: 2026-07-04T19:18:09+00:00
Current mode: implementation
Active phase: Phase 4 - Design The Unbind Trigger Phrase And Update The Skill
Active task: Phase 4 Task 2 (verification) - Audit the documented unbind contract for cross-doc consistency and confirm the updated skill package is intact

## Current State

- Initial shaping is done: problem framing, scope, risks, and the full 6-phase roadmap are captured in `docs/problem-framing.md`, `decision-log.md`, `risk-register.md`, and `tracker.md`.
- Phase 1 (Shape The Epic) is closed.
- Phase 2 (Design The Solution And Write A Proposal) is closed. The concrete proposal lives in `docs/mode-reminder-design.md`: a new `buildModeReminder(payload, binding)` in `lib/hooks.mjs`, sourced only from `binding.mode` (no extra reads), fires on `UserPromptSubmit` for bound `shaping`/`review` sessions only; `handleHook` composes it with the existing Stop-hook continuation via a single `??` fallback since the two are mutually exclusive by construction. `unbind-session.mjs`'s CLI shape, behavior, and additive `deactivated_reason` field are also fixed. See `decision-log.md` for the accepted decisions.
- The feature still has two parts: (1) the per-turn `UserPromptSubmit` mode-reminder injection via `hookSpecificOutput.additionalContext` for shaping/review-bound sessions, and (2) the new `unbind-session.mjs` script that lets the current session detach from its epic on user intent.
- Phase 3 (Validate With Real Proofs Of Concept On Codex And Claude Code) is closed. Both platforms are natively proven for `UserPromptSubmit` → `hookSpecificOutput.additionalContext`: Codex via an interactive trusted-project CLI run (token `...8273` rendered as visible hook context and echoed by the model), Claude Code via a real headless `claude -p` run (token `POC-CLAUDE-ADDCTX-1783274622` echoed exactly; the transcript JSONL carries the injection as a `hook_additional_context` attachment record). Details and limitations are in `decision-log.md`.
- The unbind trigger phrase/intent rule is intentionally undecided; Phase 4 is where it gets designed and wired into `SKILL.md`.

## Blockers

- None recorded.

## Next Action

- Run Phase 4's verification task (cross-doc unbind-contract audit), then close Phase 4 and move to Phase 5 (implement `buildModeReminder` + `unbind-session.mjs` and their unit tests). The canonical phrase `unbind epic` is decided and documented in `SKILL.md`.
