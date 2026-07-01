# Tracker

Epic: Claude Code Harness

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

### Phase 1: Platform Adapter Foundation

- Phase status: done

- [x] Kind: implementation | Status: done | Introduce doctor-driven runtime platform selection and a platform adapter boundary without changing Codex defaults.
  - Outcome: The first `doctor.mjs --platform codex|claude-code --json` call stores the selected platform in uncommitted runtime config, and platform-aware scripts use that value for Codex or Claude Code behavior.
  - Surface: `scripts/doctor.mjs`, `scripts/lib/common.mjs`, `scripts/lib/hooks.mjs`, `scripts/lib/loop.mjs`, hook payload helpers, tests.
  - Acceptance: Doctor writes runtime platform config when `--platform` is provided; platform-aware scripts fail clearly when platform config is missing or invalid; no script infers platform from payload shape, cwd, env, or config-file presence; Codex payloads still route exactly as before once `codex` is selected; Claude Code payload fixtures work once `claude-code` is selected; unbound sessions remain silent no-ops.
  - Docs: `docs/platform-adapter-contract.md`, `docs/claude-api.md`.

- [x] Kind: implementation | Status: done | Implement Claude Code assistant report capture from transcript JSONL.
  - Outcome: Manager and engineer reports are captured on Claude Code Stop events even though `last_assistant_message` is absent.
  - Surface: `scripts/lib/loop.mjs`, transcript parsing helper, role report append path, transcript fixtures, tests.
  - Acceptance: A Claude Code Stop payload with `transcript_path` appends the latest assistant report to the same runtime report files as Codex; malformed or missing transcript data fails softly without breaking continuation routing.
  - Docs: `docs/platform-adapter-contract.md`, `docs/claude-api.md`.

- [x] Kind: verification | Status: done | Verify platform adapter compatibility across Codex and Claude Code payload fixtures.
  - Outcome: The shared loop core is proven to accept both platform payload shapes without behavioral drift.
  - Surface: `tests/unit/hook-contracts.test.mjs`, `tests/unit/common.test.mjs`, synthetic transcript fixtures, `pnpm run test:unit`.
  - Acceptance: Run unit tests that cover Codex `last_assistant_message`, Claude Code `transcript_path`, missing optional fields, unbound sessions, and bound Stop continuation; evidence is passing test output and unchanged Codex assertions.
  - Docs: `docs/verification-plan.md`, `docs/platform-adapter-contract.md`.

### Phase 2: Claude Hook Setup And Doctor

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Add Claude Code hook configuration generation while preserving existing settings.
  - Outcome: The installer can add epic-loop hooks for Claude Code without damaging unrelated Claude hook settings.
  - Surface: `scripts/lib/hooks.mjs`, `scripts/install-hooks.mjs`, project-local `.claude/settings.json` handling, tests.
  - Acceptance: Installing Claude hooks adds `SessionStart`, `UserPromptSubmit`, and `Stop` command hooks to project-local `.claude/settings.json` and invokes the shared hook script; existing unrelated Claude settings and hooks remain intact; dry-run output shows the planned change.
  - Docs: `docs/platform-adapter-contract.md`, `docs/claude-api.md`.

- [ ] Kind: implementation | Status: todo | Add platform-config-driven doctor readiness checks for Codex and Claude Code.
  - Outcome: Doctor reads the selected runtime platform and reports actionable setup status for Codex or Claude Code.
  - Surface: `scripts/lib/hooks.mjs`, `scripts/doctor.mjs`, env inspection, JSON readiness contract, tests.
  - Acceptance: Doctor fails with an exact `doctor.mjs --platform codex|claude-code --json` fix when platform config is missing and no `--platform` was provided; Codex doctor output remains backward compatible after `codex` is selected; Claude doctor reports missing/stale project-local `.claude/settings.json` hooks; Claude doctor accepts `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0` or `>=20`, warns for `20..50` that loop mode may stop early and require manual continuation, and treats missing, invalid, or values below `20` as setup-required.
  - Docs: `docs/platform-adapter-contract.md`, `docs/claude-api.md`, `docs/verification-plan.md`.

- [ ] Kind: verification | Status: todo | Verify platform selection, hook installer, and doctor contracts for Codex and Claude Code temp projects.
  - Outcome: Both platform setup paths are tested through public CLI contracts rather than private helper calls only.
  - Surface: `tests/unit/cli-contracts.test.mjs`, temp project fixtures, generated platform runtime config, generated hook settings, `pnpm run test:unit`.
  - Acceptance: Tests prove missing-platform errors, platform config writes, idempotent install, stale command repair, unrelated hook preservation, dry-run behavior, and doctor JSON status for both platforms; generated files are removed with temp roots.
  - Docs: `docs/verification-plan.md`.

### Phase 3: Claude Session Binding And Loop Runtime

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Add Claude-aware current-session detection for implementation binding.
  - Outcome: `bind-session --current` can safely bind a Claude Code session when fresh hook-capture data identifies the current session.
  - Surface: `scripts/lib/common.mjs`, `scripts/lib/epics.mjs`, hook capture state, bind-session CLI, tests.
  - Acceptance: A fresh Claude Code hook capture with `session_id` and `transcript_path` can bind implementation mode; stale or ambiguous captures require explicit `--session-id`; Codex current-session fallback remains unchanged.
  - Docs: `docs/platform-adapter-contract.md`, `docs/claude-api.md`.

- [ ] Kind: implementation | Status: todo | Exercise the manager -> techlead -> engineer loop on Claude Code hook payloads.
  - Outcome: The existing implementation loop progresses through Claude Code Stop continuations using the same runtime state transitions as Codex.
  - Surface: `scripts/lib/loop.mjs`, `scripts/hook.mjs`, runtime state fixtures, role report fixtures, tests.
  - Acceptance: A bound Claude Code Stop event returns a block continuation, sets the expected next role, records progress/runtime state, captures reports from transcript JSONL, records the effective `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` at implementation start, routes to manager when a finite cap is close to exhaustion, and respects `stop_hook_active` without infinite reentry.
  - Docs: `docs/platform-adapter-contract.md`, `docs/verification-plan.md`.

- [ ] Kind: verification | Status: todo | Verify end-to-end synthetic Claude Code implementation routing.
  - Outcome: The full hook-driven loop path is proven with realistic Claude Code payload fixtures before manual CLI verification.
  - Surface: `tests/unit/hook-contracts.test.mjs`, temp epic workspace, transcript JSONL fixture, `pnpm run test:unit`.
  - Acceptance: A test initializes an epic, binds a Claude session, sends SessionStart/UserPromptSubmit/Stop payloads, observes manager and techlead continuations, captures assistant reports, confirms no records are written for unbound sessions, and proves finite block-cap proximity produces a manager communication turn before forced stop.
  - Docs: `docs/verification-plan.md`, `docs/claude-api.md`.

### Phase 4: Docs Packaging And User-Facing Contracts

- Phase status: todo

- [ ] Kind: implementation | Status: todo | Update skill and reference documentation for dual-platform operation.
  - Outcome: Users and future agents can run epic-loop on Codex or Claude Code without relying on hidden implementation knowledge.
  - Surface: `SKILL.md`, `references/hooks-and-session-routing.md`, `references/implementation-cycle.md`, platform setup docs, command examples.
  - Acceptance: Docs explain platform selection, Claude hook trust review, block-cap setup, manager communication on cap-proximity stops, current-session binding behavior, and Codex compatibility; generated artifacts remain in English.
  - Docs: `docs/problem-framing.md`, `docs/platform-adapter-contract.md`, `docs/verification-plan.md`.

- [ ] Kind: implementation | Status: todo | Update package validation for any Claude Code plugin hook assets.
  - Outcome: The published plugin package validates the project-local Claude Code hook install behavior and does not imply unsupported bundled hook assets.
  - Surface: `plugins/epic-loop/`, `scripts/validate-epic-loop-package.mjs`, package metadata, tests.
  - Acceptance: Package validation and docs reflect project-local `.claude/settings.json` as the supported Claude Code install target; Codex plugin metadata remains valid.
  - Docs: `docs/platform-adapter-contract.md`, `docs/verification-plan.md`.

- [ ] Kind: verification | Status: todo | Verify final package, docs, and regression suite.
  - Outcome: The repo is ready for review with both platform contracts documented and validated.
  - Surface: `pnpm run validate`, `pnpm run test:unit`, package validation output, targeted doc inspection.
  - Acceptance: `pnpm run validate` and `pnpm run test:unit` pass; docs contain no stale Codex-only assumptions for shared behavior; Claude-specific caveats are explicit.
  - Docs: `docs/verification-plan.md`.

### Phase 5: Runtime Acceptance

- Phase status: todo

- [ ] Kind: verification | Status: todo | Run a disposable Claude Code runtime smoke test when the CLI environment is available.
  - Outcome: The Claude Code harness is proven through an actual Claude Code session, not only synthetic payload tests.
  - Surface: Disposable project checkout, Claude Code CLI, `/hooks` trust flow, `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`, `.epic-loop/` artifacts.
  - Acceptance: A disposable epic enters implementation mode, emits manager housekeeping, hands to techlead, runs one engineer brief, captures reports from transcript JSONL, and leaves durable runtime evidence; if the CLI is unavailable, the implementation log records the unverified manual gap.
  - Docs: `docs/verification-plan.md`, `docs/claude-api.md`.

- [ ] Kind: verification | Status: todo | Perform final Codex regression smoke test after Claude Code changes.
  - Outcome: The primary Codex path remains functional after dual-platform changes.
  - Surface: Current repo checkout, Codex doctor, hook readiness, temp epic, `pnpm run validate`, `pnpm run test:unit`.
  - Acceptance: Codex doctor remains ready in this checkout, a temp epic can be initialized and rendered, existing hook contract tests pass, and no Claude-only configuration is required for Codex users.
  - Docs: `docs/verification-plan.md`.

