# Tracker

Epic: Epic-Loop Mode Reminder And Session Unbind

## Task Statuses

- todo
- doing
- need-review
- blocked
- partially-satisfied
- deferred
- reset-required
- done

## Task Kinds

- implementation
- verification
- review
- follow-up
- architecture-reset
- documentation-only

## Active Roadmap

### Phase 1: Shape The Epic

- Phase status: done

- [x] Kind: documentation-only | Status: done | Capture problem framing, desired outcome, scope, non-scope, constraints, risks, and initial open questions.
  - Outcome: The epic has enough structure for phase and task decomposition.
  - Surface: `docs/`, `decision-log.md`, `risk-register.md`, `state-of-epic.md`.
  - Acceptance: A future session can understand why this epic exists and what should happen next.
  - Docs: `docs/problem-framing.md`, `decision-log.md`, `risk-register.md`.

### Phase 2: Design The Solution And Write A Proposal

- Phase status: done

- [x] Kind: documentation-only | Status: done | Design the per-turn mode-reminder hook injection and the `unbind-session.mjs` script end-to-end, and write up a concrete proposal covering both.
  - Outcome: A written proposal exists describing the exact `UserPromptSubmit` handler change (where the mode/reminder text is read from, what text is injected, for which modes), the `unbind-session.mjs` script's flags/behavior/data-model changes, and how the two pieces fit together with the existing bind/hook machinery.
  - Surface: `docs/` (new design doc), `decision-log.md`.
  - Acceptance: The proposal is concrete enough that Phase 4/5 implementation tasks can be written without re-deriving the design; it explicitly states what happens for unbound sessions (must remain unaffected) and for each lifecycle mode.
  - Docs: `docs/problem-framing.md`, `references/hooks-and-session-routing.md`.

### Phase 3: Validate With Real Proofs Of Concept On Codex And Claude Code

- Phase status: done

- [x] Kind: verification | Status: done | Prove, with a real running Codex CLI session, that a `UserPromptSubmit` hook returning `hookSpecificOutput.additionalContext` actually works, and capture how Codex's TUI actually renders it.
  - Outcome: Documented, reproducible evidence that the mechanism works on Codex, plus a concrete note on the visible-rendering behavior observed (matching or correcting the assumption from `openai/codex` issues #16486/#16933).
  - Surface: a throwaway/POC hook script, run against a real Codex CLI session with the experimental hooks feature flag enabled.
  - Acceptance: The evidence clearly shows the injected text reaching Codex's context/UI on a real turn; any discrepancy from the assumed behavior is recorded in `decision-log.md`.
  - Docs: `docs/problem-framing.md`, `decision-log.md`.

- [x] Kind: documentation-only | Status: done | Stop this session here. The Codex POC above must be run from a real Codex CLI session, and the Claude Code POC below must be run from a real Claude Code session — each platform validates its own POC natively, not simulated from the other platform.
  - Outcome: A clean handoff point between the two POC tasks so no POC evidence is produced from the wrong platform.
  - Surface: this session only; no code changes.
  - Acceptance: Do not attempt the Claude Code POC task from within a Codex session, or vice versa. Tell the user which session/platform to open next, then stop and wait for them to resume this epic there.
  - Docs: `docs/problem-framing.md`.

- [x] Kind: verification | Status: done | Prove, with a real running Claude Code session, that the same `hookSpecificOutput.additionalContext` mechanism works, and capture how Claude Code actually renders it.
  - Outcome: Documented, reproducible evidence (transcript excerpt or equivalent) that the mechanism works as designed on Claude Code.
  - Surface: the same POC hook script, run against a real Claude Code session in this repo or an isolated scratch project.
  - Acceptance: The evidence clearly shows the injected text reaching model context on a real turn, not just a unit-test mock.
  - Docs: `docs/problem-framing.md`.

### Phase 4: Design The Unbind Trigger Phrase And Update The Skill

- Phase status: done

- [x] Kind: documentation-only | Status: done | Decide the canonical ultra-short unbind trigger phrase and the intent-recognition rule around it, then update `SKILL.md`'s frontmatter `description` and body so the skill engages unambiguously and the agent understands the bind/unbind state.
  - Outcome: A specific short phrase (and the surrounding intent-based rule) is chosen, documented, and consistent with how the skill's `description` already lists concrete triggers.
  - Surface: `SKILL.md` frontmatter `description`, relevant mode-reference sections.
  - Acceptance: The phrase and rule read naturally alongside the existing description triggers; a future session can tell from `SKILL.md` alone when to call `unbind-session.mjs`.
  - Docs: `docs/problem-framing.md`, `decision-log.md`.

### Phase 5: Implement And Write Tests

- Phase status: done

- [x] Kind: implementation | Status: done | Implement the `UserPromptSubmit` mode-reminder injection in `lib/hooks.mjs`/`lib/loop.mjs` and the new `unbind-session.mjs` script, per the Phase 2 proposal.
  - Outcome: Working code matching the accepted proposal, including the explicit guarantee that unbound sessions still produce zero output.
  - Surface: `scripts/lib/hooks.mjs`, `scripts/lib/loop.mjs`, `scripts/lib/epics.mjs`, new `scripts/unbind-session.mjs`.
  - Acceptance: Behavior matches the proposal and the Phase 3 POC evidence; existing implementation-mode hook behavior is unchanged.
  - Docs: `docs/problem-framing.md`, `decision-log.md`.

- [x] Kind: verification | Status: done | Write unit tests for the new hook behavior and `unbind-session.mjs`, following this repo's `node --test` / `runNodeScript` conventions (matching `hook-contracts.test.mjs` / `cli-contracts.test.mjs` style).
  - Outcome: Tests cover: mode reminder injected for bound shaping/review sessions, no reminder/no output for unbound sessions, `unbind-session.mjs` deactivating the current session, and hooks becoming no-ops for that session id afterward.
  - Surface: `tests/unit/`.
  - Acceptance: New tests fail against the pre-implementation state and pass after Phase 5's implementation task.
  - Docs: `docs/problem-framing.md`.

### Phase 6: Run The Full Test Suite

- Phase status: done

- [x] Kind: verification | Status: done | Run `pnpm run test:unit` and `pnpm run validate` and confirm everything is green, including the new tests from Phase 5.
  - Outcome: Full green test run with no regressions in existing hook/loop/roadmap tests.
  - Surface: whole repo test suite.
  - Acceptance: `pnpm run test:unit` and `pnpm run validate` both exit clean.
  - Docs: `implementation-log.md`.

## Follow-Up Tasks

- [x] Kind: verification | Status: done | Phase 4 verification gate: cross-doc audit of the documented unbind contract (executed 2026-07-06)
  - Outcome: Zero discrepancies across SKILL.md, docs/mode-reminder-design.md section 2, and decision-log.md (flags, no-op, silent-hooks, rebind semantics, verbatim 'unbind epic' phrase); frontmatter YAML valid; runtime copies diff-clean; validate passed; 33/33 unit tests green
  - Surface: read-only audit plus package checks; no code changes
  - Acceptance: Met - discrepancy list empty; recorded here as a follow-up entry because hand-added tracker tasks do not survive roadmap re-renders (see implementation-log 2026-07-06)
  - Docs: docs/mode-reminder-design.md, decision-log.md

- [x] Kind: documentation-only | Status: done | Update hooks-and-session-routing.md for the new reminder/unbind hook behavior and sync runtime copies
  - Outcome: references/hooks-and-session-routing.md reflects the two new hook behaviors (UserPromptSubmit mode reminder for shaping/review bindings; user-requested unbind lifecycle), and .claude/.codex runtime copies are re-synced from plugins/ now that the Phase 5 tests are green
  - Surface: plugins/epic-loop/skills/epic-loop/references/hooks-and-session-routing.md; pnpm run self-update
  - Acceptance: Reference doc mentions the reminder output path and unbind deactivation consistently with SKILL.md; diff -rq of both runtime copies vs plugins/ clean except .runtime; full test suite still green
  - Docs: docs/mode-reminder-design.md, decision-log.md

