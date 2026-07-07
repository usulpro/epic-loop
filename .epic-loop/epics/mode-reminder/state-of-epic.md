# State Of Epic

Epic: Epic-Loop Mode Reminder And Session Unbind
Slug: `mode-reminder`
Created: 2026-07-04T19:18:09+00:00
Active phase: none - Phase 7 closed
Active task: TBD

## Current State

- Initial shaping is done: problem framing, scope, risks, and the full 6-phase roadmap are captured in `docs/problem-framing.md`, `decision-log.md`, `risk-register.md`, and `tracker.md`.
- Phase 1 (Shape The Epic) is closed.
- Phase 2 (Design The Solution And Write A Proposal) is closed. The concrete proposal lives in `docs/mode-reminder-design.md`: a new `buildModeReminder(payload, binding)` in `lib/hooks.mjs`, sourced only from `binding.mode` (no extra reads), fires on `UserPromptSubmit` for bound `shaping`/`review` sessions only; `handleHook` composes it with the existing Stop-hook continuation via a single `??` fallback since the two are mutually exclusive by construction. `unbind-session.mjs`'s CLI shape, behavior, and additive `deactivated_reason` field are also fixed. See `decision-log.md` for the accepted decisions.
- Both feature parts are now implemented and test-covered: (1) the per-turn `UserPromptSubmit` mode-reminder injection via `hookSpecificOutput.additionalContext` for shaping/review-bound sessions (`buildModeReminder` in `lib/hooks.mjs`), and (2) `scripts/unbind-session.mjs` detaching the current session from its epic on user intent (`unbindSession` in `lib/epics.mjs`).
- Phase 3 (Validate With Real Proofs Of Concept On Codex And Claude Code) is closed. Both platforms are natively proven for `UserPromptSubmit` → `hookSpecificOutput.additionalContext`: Codex via an interactive trusted-project CLI run (token `...8273` rendered as visible hook context and echoed by the model), Claude Code via a real headless `claude -p` run (token `POC-CLAUDE-ADDCTX-1783274622` echoed exactly; the transcript JSONL carries the injection as a `hook_additional_context` attachment record). Details and limitations are in `decision-log.md`.
- Phase 4 (Design The Unbind Trigger Phrase And Update The Skill) is closed. The canonical phrase is `unbind epic` (intent-based proactive unbind with the phrase as reliable fallback); `SKILL.md`'s frontmatter description and a `## Hooks` subsection now document the full `unbind-session.mjs` contract, runtime copies are re-synced, and a cross-doc audit confirmed zero discrepancies against `docs/mode-reminder-design.md` and `decision-log.md`.
- Phase 5 (Implement And Write Tests) is closed. Implementation matches the accepted design (commits `64b6c81` code, `02d6fae` tests); `tests/unit/unbind-and-reminder.test.mjs` pins both contracts with 10 end-to-end cases; `references/hooks-and-session-routing.md` documents the new behaviors; runtime copies re-synced via `self-update` after the green suite (both diff-clean).
- Phase 6 (Run The Full Test Suite) is closed. Final verification: `pnpm run test:unit` 43/43/0 with all 10 new tests present, `pnpm run validate` exit 0, both runtime copies diff-clean vs `plugins/`.
- Follow-up shaping reopened on 2026-07-06 to investigate a binding lifecycle gap: shaping/review reminders work after explicit binding, but normal shaping did not bind the session, and switching the same session between shaping epics left a stale `active_sessions["set-up:shaping"]` pointer.
- Follow-up shaping completed on 2026-07-07 in two passes. First pass reviewed the binding-lifecycle gap against the actual code and produced a per-binding-mode fix plan (now the superseded-marked Accepted Plan in `docs/shaping-binding-gap.md`). Second pass, on user direction, replaced it with the **epic-centric mode model** (`docs/epic-mode-model.md`): the epic holds exactly one mode in `runtime-state.json` (sole machine source; the `Current mode:` prose line in this file gets dropped by Phase 7), bindings become mode-less epic membership so any number of sessions per epic receive the compact `[epic-loop] epic=<slug> mode=<mode>` marker, a mode change by one session propagates to all members' next turn, `active_sessions` is deleted (stale-pointer bug class removed by construction), and implementation keeps one exclusive driver session recorded in the epic runtime state, with non-driver members receiving an advisory read-only lock marker while the loop runs.
- Phase 7 is closed. Source-package work and verification are complete: runtime mode source, mode-less membership plus exclusive implementation driver, compact markers, resume auto-bind, full unit/validation checks, and live Claude Code multi-session evidence are recorded in `implementation-log.md`. Installed runtime copies remain intentionally unsynced and are not required for this phase.

## Blockers

- None recorded.

## Next Action

- Run phase-closure housekeeping, then finish implementation mode if no housekeeping blocker appears.
