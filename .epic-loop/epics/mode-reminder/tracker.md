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

### Phase 7: Epic-Centric Mode Model And Compact Reminder

- Phase status: doing

- [x] Kind: implementation | Status: done | Make `runtime-state.json` `mode` the sole lifecycle mode source and drop the human-readable `Current mode:` line.
  - Outcome: The epic's lifecycle mode lives only in `.runtime/runtime-state.json` `mode`, is maintained across all transitions via scripts, and no code parses `state-of-epic.md` prose for it.
  - Surface: New `scripts/set-epic-mode.mjs` (+ helper in `scripts/lib/epics.mjs`); `init-epic` state template (remove the `Current mode:` line); `readEpicStateSummary` in `scripts/lib/loop.mjs` and any other prose-mode consumers; `SKILL.md` mode-transition instructions; unit tests.
  - Acceptance: `set-epic-mode.mjs --slug <slug> --mode shaping|implementation|review` validates the mode and writes `mode` + `updated_at`; `init-epic` no longer emits `Current mode:` and nothing regex-parses it (`readEpicStateSummary` reads runtime-state instead); `SKILL.md` instructs calling the script on every lifecycle transition (reopen shaping, enter review); missing/corrupt runtime-state makes hooks silently skip and scripts fail explicitly, never guess; tests cover transitions and the no-prose-parsing contract.
  - Docs: docs/epic-mode-model.md

- [x] Kind: implementation | Status: done | Rework session bindings to mode-less epic membership with an exclusive implementation driver.
  - Outcome: Bindings answer only "which epic does this session belong to"; many sessions can be active members of one epic; `active_sessions` is deleted from the schema; implementation keeps exactly one driver session recorded in the epic's `runtime-state.json`.
  - Surface: `bindSession`/`unbindSession` in `scripts/lib/epics.mjs`; `getSessionBinding`, `maybeBuildImplementationContinuation` gate, `markInterruptedTurnIfNeeded` gate in `scripts/lib/hooks.mjs`/`lib/loop.mjs`; `startImplementationLoop` driver designation; `bind-session.mjs`/`unbind-session.mjs` CLI docs; existing binding tests.
  - Acceptance: Binding entries carry no `mode`; multiple simultaneous active members of one epic are supported while a session still holds at most one active binding; `active_sessions` is gone and readers tolerate the old leftover shape (stale-pointer bug class removed by construction); entering implementation designates `implementation_loop.driver_session_id` (replacing any previous driver) and only the driver's `Stop` events continue the loop; a `UserPromptSubmit` from a non-driver member does not interrupt the loop; unbinding the driver sets the loop to `idle` with a clear reason; parallel work on different epics is unaffected.
  - Docs: docs/epic-mode-model.md

- [x] Kind: implementation | Status: done | Emit the compact mode marker to all member sessions, plus a read-only lock marker for non-driver members during implementation.
  - Outcome: On `UserPromptSubmit` every active member session of a `shaping`/`review` epic receives exactly `[epic-loop] epic=<slug> mode=<mode> — follow epic-loop skill mode rules`; during `implementation` non-driver members receive the lock marker `[epic-loop] epic=<slug> mode=implementation — loop running in another session; read-only, do not edit epic artifacts` while the driver receives nothing; a mode change by one session propagates to every member's next turn without rebinding.
  - Surface: `buildModeReminder` + `MODE_REMINDER_TEXT` in `scripts/lib/hooks.mjs` (source mode from epic runtime-state, not the binding); `SKILL.md` frontmatter description plus a concise body note; unit tests.
  - Acceptance: Reminder mode comes from `runtime-state.json`, not the binding; unbound sessions stay silent no-ops; two bound sessions on one epic both receive the shaping/review marker, and after one of them runs `set-epic-mode.mjs` the other's next reminder reflects the new mode — pinned by tests; in implementation mode the driver gets no reminder and a non-driver member gets exactly the lock marker text — pinned by tests; frontmatter description mentions the `[epic-loop] epic=... mode=...` marker pattern and stays within the 1024-char Claude Code limit (currently 895 chars); body note explains both marker variants (mode rules vs read-only lock; the lock is advisory, not a mechanical write barrier); installed runtime copies were intentionally not synced because runtime promotion is a manual step in this repo.
  - Docs: docs/epic-mode-model.md, docs/mode-reminder-design.md, references/hooks-and-session-routing.md

- [x] Kind: implementation | Status: done | Auto-bind the current session as an epic member when resuming by slug or path.
  - Outcome: Resuming an epic binds the current session as a member (no mode flag); reminders follow the epic's current mode from the next turn; the implementation start/resume confirmation flow is unchanged.
  - Surface: `SKILL.md` resume flow; `bind-session.mjs` membership usage; capture freshness validation at the bind call site; tests for shaping/review/implementation resume cases.
  - Acceptance: For a `shaping`/`review` epic the session is auto-bound as a member and the marker appears on the next turn; for an `implementation` epic no driver is designated automatically and the existing explicit confirmation flow is unchanged; the `--current` capture is accepted for auto-bind only when fresh AND `hook_event_name === "UserPromptSubmit"` (last-writer-wins race guard; Codex mtime fallback is rejected for auto-bind); when no acceptable capture exists (e.g. stale capture, non-`UserPromptSubmit`, wrong-root capture, or missing Claude transcript path) auto-bind is skipped with a one-line notice and orientation continues; `SKILL.md` Parallel Work section and `references/parallel-sessions.md` are updated to the v2 semantics (one epic mode shared by all member sessions; different-modes-per-epic no longer a supported state).
  - Docs: docs/epic-mode-model.md, references/hooks-and-session-routing.md, references/parallel-sessions.md

- [ ] Kind: verification | Status: todo | Phase-level verification: full suite plus a live multi-session Claude Code check of the epic-centric model.
  - Outcome: Proven-green phase result: unit suite and package validation pass, runtime copies are clean, and the membership/marker/mode-propagation behavior is observed working in real sessions.
  - Surface: Whole repo test suite; real Claude Code sessions in this repo (method analogous to the Phase 3 POC).
  - Acceptance: `pnpm run test:unit` and `pnpm run validate` exit clean including all new Phase 7 tests; `diff -rq` of both runtime copies vs `plugins/` is clean except `.runtime`; live evidence (transcript attachment or echoed token, as in Phase 3) shows: (a) a session resuming a shaping epic receives the compact marker on the next turn, (b) two member sessions of the same epic both receive it, (c) after `set-epic-mode.mjs` changes the mode, the other session's next reminder reflects the change, and with the mode set to implementation a non-driver member receives the read-only lock marker while the driver receives none; `session-bindings.json` contains mode-less membership entries and no `active_sessions` map.
  - Docs: implementation-log.md, decision-log.md

- [x] Kind: verification | Status: done | Phase 4 verification gate: cross-doc audit of the documented unbind contract (executed 2026-07-06)
  - Outcome: Zero discrepancies across SKILL.md, docs/mode-reminder-design.md section 2, and decision-log.md (flags, no-op, silent-hooks, rebind semantics, verbatim 'unbind epic' phrase); frontmatter YAML valid; runtime copies diff-clean; validate passed; 33/33 unit tests green
  - Surface: read-only audit plus package checks; no code changes
  - Acceptance: Met - discrepancy list empty; recorded as a follow-up entry because hand-added tracker tasks do not survive roadmap re-renders (see implementation-log 2026-07-06)
  - Docs: docs/mode-reminder-design.md, decision-log.md

- [x] Kind: documentation-only | Status: done | Update hooks-and-session-routing.md for the new reminder/unbind hook behavior and sync runtime copies
  - Outcome: references/hooks-and-session-routing.md reflects the two new hook behaviors (UserPromptSubmit mode reminder for shaping/review bindings; user-requested unbind lifecycle), and .claude/.codex runtime copies are re-synced from plugins/ now that the Phase 5 tests are green
  - Surface: plugins/epic-loop/skills/epic-loop/references/hooks-and-session-routing.md; pnpm run self-update
  - Acceptance: Reference doc mentions the reminder output path and unbind deactivation consistently with SKILL.md; diff -rq of both runtime copies vs plugins/ clean except .runtime; full test suite still green
  - Docs: docs/mode-reminder-design.md, decision-log.md
