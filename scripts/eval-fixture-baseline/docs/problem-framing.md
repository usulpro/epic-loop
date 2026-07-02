# Epic Problem Framing

## Problem

The epic-loop implementation flow needs a realistic but low-risk eval scenario that exercises normal phase and task orchestration without changing the plugin product code.

This epic provides that fixture by asking the loop to create a tiny isolated JavaScript project under `temp/eval-fixture-project`, initialize it as a nested git repository, implement several small utility modules, write tests for them, verify the work, commit fixture work inside the nested repository, and leave the completed fixture available for inspection.

## Desired Outcome

- A normal-looking epic with two implementation phases and concrete tasks.
- Each phase contains at least one verification task with explicit commands, evidence, setup, and cleanup notes.
- The implementation loop has enough real work to exercise manager, techlead, engineer, tracker transitions, logs, and verification behavior.
- Task-owned commits for fixture work happen inside the nested fixture repository, not in the root repository.
- The final repository state should retain `temp/eval-fixture-project` until `npm run eval-fixture-reset` is run.

## Scope

- Create files only under `temp/eval-fixture-project` during implementation.
- Initialize `temp/eval-fixture-project` as its own git repository before creating utility modules.
- Run fixture git commands from inside `temp/eval-fixture-project` or with `git -C temp/eval-fixture-project ...`; do not stage or commit fixture output from the root repository.
- Use built-in Node.js facilities where possible: .mjs modules and `node:test`.
- Implement simple but non-trivial pure functions with edge cases and tests.
- Run verification commands that prove the functions and tests work.
- Provide a repository reset script that restores this epic baseline and removes `temp/eval-fixture-project`.

## Non-Scope

- No changes to the epic-loop plugin, hook scripts, production package configuration, or production source during the epic implementation itself.
- No new package dependencies.
- No network services, browser automation, database, or external APIs.
- No implementation cleanup task that deletes the fixture folder after successful completion.

## Constraints

- The eval mini-project must stay isolated from the main repository.
- The root repository keeps `temp/` ignored; the nested fixture repository owns fixture commits.
- Implementation must be easy for different agents to complete independently.
- The work should be simple enough for stable eval runs but detailed enough to reveal broken task routing, role switching, status updates, or verification.
- `temp/` is ignored by git, so completed fixture output should remain local runtime material.

## Reset

Run:

```bash
npm run eval-fixture-reset
```

The reset script copies `scripts/eval-fixture-baseline` over `.epic-loop/epics/eval-fixture` and removes `temp/eval-fixture-project`.

## Open Questions

- None. The epic is ready for implementation once the user explicitly starts it in a session.
