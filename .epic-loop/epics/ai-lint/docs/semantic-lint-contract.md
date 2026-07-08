# Focused AI Semantic Lint Contract

## Context

The first AI-backed `review:skills:ai` runner behaved like a broad semantic reviewer. Three live runs produced useful signals, but the results were unstable:

- The same trigger-boundary concern appeared as both `error` and `warning`.
- A real session-id path-boundary bug appeared in one run and was missed in later runs.
- Warning-level concerns were phrased under different codes across runs.
- The command was validating JSON shape deterministically, but the model owned too much of the review scope, code taxonomy, and severity policy.

The maintainer decision is to keep a single `review:skills:ai` command and narrow it into a focused semantic lint boundary.

## Design Goal

The command should check fixed semantic contracts that ordinary deterministic tooling cannot verify well. It should not behave like a general code review.

The model should answer predefined questions with evidence. The repository should own:

- check ids
- target files
- pass/fail criteria
- severity defaults
- blocking policy
- output schema
- generated-output location

## Non-Goals

- Do not split the package scripts into separate broad-review and lint commands.
- Do not ask the model to inspect every possible script safety concern.
- Do not rely on local installed skills such as `skill-creator` being active inside `codex exec`.
- Do not include AI review in `pnpm run validate`.
- Do not treat a single live AI run as deterministic proof of package quality.

## Skill-Creation Principles To Encode

Use these principles as repo-owned check guidance, not as a runtime dependency on any installed skill:

- `SKILL.md` frontmatter controls trigger decisions and must be precise.
- `SKILL.md` should stay concise and route detailed mode behavior into references.
- References should be loaded conditionally and task-locally.
- Fragile operations need exact scripts and guardrails.
- Judgment-heavy work should preserve appropriate degrees of freedom.
- Validation integrity matters: tests should not leak the expected answer into the model context.

## Initial Fixed Checks

### `skill.description.trigger-boundary`

Target files:

- `plugins/epic-loop/skills/epic-loop/SKILL.md`

Question:

Does the skill description allow activation for useful `.epic-loop/` artifact understanding/editing while avoiding implied permission to run lifecycle commands, bind sessions, mutate runtime state, or start implementation unless the user intent or hook context asks for that?

Expected pass:

- Mentions active epic-loop workspace or artifact work clearly enough to trigger the skill for real epic artifacts.
- Does not imply ordinary package/source review of the plugin grants permission to run lifecycle/runtime actions.
- Preserves the contract that implementation starts only after explicit confirmation.

Default severity on fail: `warning`, unless the wording directly permits implementation start or runtime mutation without user intent.

### `skill.reentry.mode-conditional-orientation`

Target files:

- `plugins/epic-loop/skills/epic-loop/SKILL.md`
- `plugins/epic-loop/skills/epic-loop/references/implementation-techlead-role.md`
- `plugins/epic-loop/skills/epic-loop/references/implementation-manager-role.md`
- `plugins/epic-loop/skills/epic-loop/references/implementation-engineer-role.md`

Question:

Does the entrypoint avoid forcing broad artifact reads for every non-trivial turn, and does implementation mode orient from `role-summary.mjs` plus selective reads?

Expected pass:

- Normal orientation is mode-conditional.
- Implementation mode uses `role-summary.mjs` as the default entrypoint.
- Logs, decision registers, risk registers, and runtime/debug artifacts are read only when the mode decision needs them.

Default severity on fail: `warning`.

### `skill.lifecycle.explicit-implementation-start`

Target files:

- `plugins/epic-loop/skills/epic-loop/SKILL.md`
- `plugins/epic-loop/skills/epic-loop/references/implementation-cycle.md`

Question:

Does the skill consistently require explicit current-session user confirmation before binding a session and starting implementation mode?

Expected pass:

- Slug-only resume is orientation, not implementation permission.
- `bind-session --current --mode implementation` appears only after explicit confirmation.
- After binding, the agent stops and lets the trusted hook continue the loop.

Default severity on fail: `error`.

### `skill.parallel-sessions.mode-consistency`

Target files:

- `plugins/epic-loop/skills/epic-loop/SKILL.md`
- `plugins/epic-loop/skills/epic-loop/references/parallel-sessions.md`
- `plugins/epic-loop/skills/epic-loop/references/hooks-and-session-routing.md`

Question:

Do the entrypoint and references describe same-epic parallel sessions consistently?

Expected pass:

- Many sessions may be members of the same epic.
- A session has only one active mode at a time.
- Implementation has one exclusive driver while other members remain observers.
- Same-epic session behavior does not conflict between `SKILL.md` and references.

Default severity on fail: `error` for contradictions that can cause conflicting writes; otherwise `warning`.

### `skill.runtime-artifacts.normal-flow-boundary`

Target files:

- `plugins/epic-loop/skills/epic-loop/SKILL.md`
- `plugins/epic-loop/skills/epic-loop/references/implementation-techlead-role.md`
- `plugins/epic-loop/skills/epic-loop/references/implementation-manager-role.md`
- `plugins/epic-loop/skills/epic-loop/references/hooks-and-session-routing.md`

Question:

Do normal operating instructions keep agents away from `.runtime/**` debug artifacts unless a specific runtime/debug task requires them?

Expected pass:

- Human-facing artifacts are distinguished from runtime/debug artifacts.
- Normal implementation roles avoid prompt/progress logs, hook events, session files, and raw runtime traces.
- Runtime writes are routed through scripts/hooks rather than manual file edits.

Default severity on fail: `warning`, or `error` if instructions direct agents to inspect sensitive/raw runtime payloads by default.

## Output Shape Direction

Prefer a report shape centered on checks:

```json
{
  "schemaVersion": 2,
  "status": "pass",
  "summary": "Focused semantic lint completed.",
  "checks": [
    {
      "id": "skill.lifecycle.explicit-implementation-start",
      "status": "pass",
      "severity": "error",
      "evidence": [],
      "message": "Implementation start requires explicit confirmation.",
      "recommendation": null
    }
  ]
}
```

The runner may derive path-oriented findings from failed checks for display, but the model should not invent arbitrary finding codes.

## Verification Expectations

- Mocked valid report exits `0`.
- Mocked warning report exits `0` with stable diagnostics.
- Mocked failed `error` check exits non-zero.
- Unknown check ids fail schema validation.
- Missing checks fail schema validation.
- Malformed JSON and missing output remain non-zero.
- `pnpm run validate` remains green and non-AI-backed.
- Live repeated runs are compared by check id and status, not by free-form finding text.
