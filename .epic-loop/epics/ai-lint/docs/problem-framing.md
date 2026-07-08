# Epic Problem Framing

## Problem

Replace the broad AI skill review with focused semantic lint checks for epic-loop skill drift and degradation, based on the maintainer discussion about unstable model-backed review findings.

## Desired Outcome

- `pnpm run review:skills:ai` remains the single maintainer-facing AI review command.
- The command becomes a focused semantic lint boundary, not a broad code-review-like reviewer.
- The model evaluates a fixed repository-owned check catalog with stable check ids, target files, pass/fail criteria, and severity policy.
- The output is stable enough for maintainer workflow: repeated runs may vary in wording, but not in check identity, severity ownership, or scope.
- AI checks focus on semantic instruction contracts that deterministic tools cannot reliably verify.

## Scope

- Refactor the AI review prompt/schema to use fixed checks instead of free-form findings.
- Define a small initial semantic check catalog for the maintained `epic-loop` skill package.
- Preserve the existing command name: `review:skills:ai`.
- Keep deterministic validation separate from AI-backed validation; do not add AI review to `pnpm run validate`.
- Use skill-building principles from `skill-creator` as design input, but make the command self-contained and repo-owned.
- Add mocked tests for report validation, check formatting, blocking policy, and command-level behavior.
- Verify live `codex exec` behavior after the fixed-check boundary is implemented.

## Non-Scope

- Do not split the command into separate broad-review and lint commands.
- Do not depend on installed user/system skills being available inside `codex exec`.
- Do not make AI review a CI gate or deterministic validation replacement.
- Do not ask the model to perform general script security review, broad code review, or free-form skill critique.
- Do not fix unrelated semantic warnings unless they are part of the fixed check catalog and fail the new criteria.
- Do not change runtime hook behavior except where a fixed check reveals a confirmed narrow bug that gets scheduled as a separate implementation task.

## Constraints

- Generated artifacts must stay under ignored `.validation-output/skill-review/`.
- The runner must continue to validate model output deterministically before deciding pass/fail.
- Check ids and severity defaults are owned by repository code, not invented by the model.
- The model should return evidence for predefined checks, not create arbitrary finding categories.
- `status: fail` should be reserved for fixed blocking checks with confirmed semantic contract failure.
- Warning-level findings should support maintainer triage without blocking by default.
- Any live Codex review variability must be managed by schema design, check catalog boundaries, and tests.

## Open Questions

- Should the first implementation preserve the top-level `findings` array for backward compatibility, or migrate to a `checks` array with derived findings?
- Should blocking require a single failed `error` check, or should repeated live-run consensus be introduced later?
- Should broad advisory review remain available only through a separate manual prompt outside repository scripts?
