# State Of Epic

Epic: Epic-Loop Mode Reminder And Session Unbind
Slug: `mode-reminder`
Created: 2026-07-04T19:18:09+00:00
Current mode: implementation
Active phase: Phase 5 - Implement And Write Tests
Active task: Phase 5 Task 2 - Write unit tests for the new hook behavior and `unbind-session.mjs`, following this repo's `node --test` / `runNodeScript` conventions (matching `hook-contracts.test.mjs` / `cli-contracts.test.mjs` style)

## Current State

- Initial shaping is done: problem framing, scope, risks, and the full 6-phase roadmap are captured in `docs/problem-framing.md`, `decision-log.md`, `risk-register.md`, and `tracker.md`.
- Phase 1 (Shape The Epic) is closed.
- Phase 2 (Design The Solution And Write A Proposal) is closed. The concrete proposal lives in `docs/mode-reminder-design.md`: a new `buildModeReminder(payload, binding)` in `lib/hooks.mjs`, sourced only from `binding.mode` (no extra reads), fires on `UserPromptSubmit` for bound `shaping`/`review` sessions only; `handleHook` composes it with the existing Stop-hook continuation via a single `??` fallback since the two are mutually exclusive by construction. `unbind-session.mjs`'s CLI shape, behavior, and additive `deactivated_reason` field are also fixed. See `decision-log.md` for the accepted decisions.
- The feature still has two parts: (1) the per-turn `UserPromptSubmit` mode-reminder injection via `hookSpecificOutput.additionalContext` for shaping/review-bound sessions, and (2) the new `unbind-session.mjs` script that lets the current session detach from its epic on user intent.
- Phase 3 (Validate With Real Proofs Of Concept On Codex And Claude Code) is closed. Both platforms are natively proven for `UserPromptSubmit` → `hookSpecificOutput.additionalContext`: Codex via an interactive trusted-project CLI run (token `...8273` rendered as visible hook context and echoed by the model), Claude Code via a real headless `claude -p` run (token `POC-CLAUDE-ADDCTX-1783274622` echoed exactly; the transcript JSONL carries the injection as a `hook_additional_context` attachment record). Details and limitations are in `decision-log.md`.
- Phase 4 (Design The Unbind Trigger Phrase And Update The Skill) is closed. The canonical phrase is `unbind epic` (intent-based proactive unbind with the phrase as reliable fallback); `SKILL.md`'s frontmatter description and a `## Hooks` subsection now document the full `unbind-session.mjs` contract, runtime copies are re-synced, and a cross-doc audit confirmed zero discrepancies against `docs/mode-reminder-design.md` and `decision-log.md`.

## Blockers

- None recorded.

## Next Action

- Start Phase 5: implement `buildModeReminder` in `lib/hooks.mjs` and `scripts/unbind-session.mjs` per `docs/mode-reminder-design.md`, then the unit tests (including the default `--reason` value `user-requested-unbind` follow-up noted in `implementation-log.md`).
