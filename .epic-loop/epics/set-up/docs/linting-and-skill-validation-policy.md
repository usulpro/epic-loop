# Linting And Skill Validation Policy

## Baseline

- Package manager: `pnpm@11.9.0`.
- Runtime style: Node.js ESM (`"type": "module"`).
- Existing checks:
  - `pnpm run test:unit`
  - `pnpm run validate`
  - `pnpm run validate:epic-loop`
  - platform doctor scripts for Codex and Claude Code.
- Current `validate` performs `node --check` over selected scripts and runs `scripts/validate-epic-loop-package.mjs`.
- No oxlint, Oxfmt, or EditorConfig is currently present.

## Policy Direction

Use standard tooling for standard concerns and small repository-owned scripts for project-specific skill package validation:

- oxlint for JavaScript/ESM source, tests, scripts, and package code.
- Oxfmt (`oxfmt`) for formatting supported text/code/doc files.
- Deterministic Node.js validation for mechanical skill package invariants.
- A separate AI-assisted review command for semantic skill quality signals.

## Proposed Oxlint Profile

Research date: 2026-07-07.

Recommended first-pass profile:

- Enable default oxlint plugins plus `import`, `node`, and `promise`: `eslint`, `typescript`, `unicorn`, `oxc`, `import`, `node`, `promise`.
- Treat `correctness` as `error`.
- Treat `suspicious` as `warn` at first, then promote selected low-noise rules after repository cleanup.
- Keep `style`, `restriction`, `pedantic`, and `nursery` disabled globally.
- Keep `perf` disabled globally for the first pass; consider warning-only later for targeted rules.

Rules to explicitly allow or tune for this repository:

- Disable `eslint/no-console`, because this repository contains command-line utilities and validation scripts where stdout/stderr are product output.
- Disable `unicorn/no-process-exit`, because CLI entry points intentionally set exit status.
- Disable `node/no-sync`, because small deterministic repository scripts intentionally use synchronous filesystem operations.
- Disable `unicorn/no-array-sort` while the CLI package supports Node.js `>=18`; `Array#toSorted()` is not a safe baseline assumption for every supported runtime.
- Allow `__dirname` for `eslint/no-underscore-dangle`, because the CLI uses the standard ESM `fileURLToPath` dirname shim.
- Enable `eslint/max-lines` explicitly as a targeted maintainability rule, with `max: 600` for source files and `max: 900` for test files.
- Enable `eslint/max-lines-per-function` explicitly as a targeted maintainability rule, with `max: 150` for functions.
- Configure both line-count rules with `skipBlankLines: true` and `skipComments: true` so the limits focus on maintained code shape rather than spacing or explanatory comments.
- Do not enable `restriction` globally: it flags optional chaining, object spread, async/await, console output, and other patterns that are acceptable for this repository.
- Do not enable `style` globally: it creates broad formatting/preference churn such as `sort-keys`, `no-magic-numbers`, `func-style`, `no-ternary`, and null bans.

Observed current repository findings with oxlint 1.73.0:

- Default correctness pass reports three small issues: one unused import, one unnecessary regex escape, and one unnecessary object spread fallback.
- `suspicious` adds mostly useful warning candidates: missing `cause` on rethrown errors, mutable `Array#sort()` suggestions, and `__dirname` naming noise.
- `perf` adds a small number of warning candidates, including `no-await-in-loop`, `prefer-set-has`, and `oxc/no-map-spread`; these are better handled after the baseline passes.
- `style` and `restriction` generate large noisy reports and should not block the initial linting setup.

## Validation Contract

`pnpm run validate` should become the single command that proves the repository is publishable:

- syntax checks still run
- package validation still runs
- unit tests either run directly or remain available through a documented validation script
- oxlint check runs
- Oxfmt check runs
- deterministic skill package checks run

Formatting write commands should be separate from check commands so validation remains non-mutating.

## Custom Skill Repository Validator Candidates

Research date: 2026-07-07.

These are not built-in oxlint or Oxfmt rules. They are repository-specific skill quality checks derived from OpenAI Codex, Anthropic Claude Code, and Agent Skills documentation.

Implementation should split them into two layers:

- Deterministic validation for mechanical invariants that can be proven offline and should block `pnpm run validate`.
- AI-assisted review for semantic quality signals that require judgment and should run through a separate script command. The script should make the workflow look like a normal validation command externally, while internally using `codex exec` in non-interactive mode.

Primary sources:

- OpenAI Codex Agent Skills documentation: `https://developers.openai.com/codex/skills`
- OpenAI Codex plugin authoring documentation: `https://developers.openai.com/codex/plugins/build`
- Agent Skills open specification: `https://agentskills.io/specification`
- Anthropic Agent Skills overview: `https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview`
- Anthropic skill authoring best practices: `https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices`
- Claude Code skills documentation: `https://code.claude.com/docs/en/skills`

Portable skill shape rules worth considering for repository validation:

- Every skill directory should contain a `SKILL.md` entrypoint.
- `SKILL.md` frontmatter should parse as YAML and include `name` and `description`.
- `name` should be 1-64 characters, lowercase kebab-case, contain only letters, numbers, and hyphens, not start or end with a hyphen, not contain consecutive hyphens, and match the parent skill directory for portable skill packages.
- `description` should be 1-1024 characters, avoid XML tags, describe both what the skill does and when to use it, and include concrete trigger terms.
- Skill instructions should stay concise. Anthropic recommends keeping the `SKILL.md` body under 500 lines for performance; the Agent Skills specification recommends splitting longer content into referenced files and notes a recommended instruction budget under 5000 tokens.
- Large or conditional detail should move to directly linked `references/` files rather than deeply nested reference chains.
- Reference files over 100 lines should include a table of contents near the top.
- Skill paths in instructions should use forward slashes for cross-platform compatibility.
- Scripts bundled with skills should live under `scripts/`, document dependencies, handle expected errors, and print actionable diagnostics.
- Skills that depend on external tools or MCP servers should declare those dependencies in product-specific metadata where supported, such as Codex `agents/openai.yaml`.
- Skills should avoid time-sensitive instructions in the active happy path; deprecated or historical behavior should live in an explicit old-patterns section.
- Skills should use consistent terminology across `SKILL.md` and referenced files.
- Security review should treat skills like software packages: audit bundled scripts, resources, external fetches, unexpected network calls, and file access patterns.

Candidate deterministic checks for this repository:

- Extend the existing package validator or add a focused validator that checks `SKILL.md` frontmatter, name/description shape, directory-name match, and description length.
- Add a documentation-shape check for `SKILL.md` line count, direct reference links, table-of-contents presence in long reference files, and forward-slash paths.
- Add a script-shape check for bundled skill scripts: expected extension, executable entrypoints where needed, syntax checks, and no accidental runtime/debug artifacts.

Candidate AI-assisted checks for this repository:

- Review whether each skill description gives reliable implicit invocation signals and clear non-trigger boundaries.
- Review whether `SKILL.md` uses progressive disclosure well instead of overloading the entrypoint.
- Review whether references are organized around task-local context rather than broad manuals.
- Review whether instructions give the right degree of freedom: exact scripts for fragile operations, heuristics for judgment-heavy work.
- Review whether bundled scripts and external dependencies create security or data-exposure concerns beyond what deterministic checks can prove.
- Add eval or fixture coverage for skill discovery descriptions, especially explicit invocation terms and implicit trigger phrases.

### AI-Assisted Skill Review Runner

The AI-assisted layer should be script-driven from the user's perspective:

```bash
pnpm run review:skills:ai
```

Proposed implementation shape:

1. A repository-owned runner script invokes `codex exec --ephemeral` with a focused prompt or repo-local review skill.
2. The Codex run reads the skill package, `SKILL.md`, references, scripts, and policy docs.
3. The Codex run writes a structured JSON report into an ignored output directory, for example `.validation-output/skill-review/latest.json`.
4. The runner reads that JSON, validates its schema deterministically, prints findings in a stable format, and exits non-zero when blocking findings exist.

The report schema should be intentionally small and stable:

```json
{
  "schemaVersion": 1,
  "status": "pass",
  "summary": "Short review summary.",
  "findings": [
    {
      "severity": "error",
      "code": "skill.description.too-broad",
      "path": "plugins/epic-loop/skills/epic-loop/SKILL.md",
      "line": 2,
      "message": "Description can trigger outside epic-loop work.",
      "recommendation": "Narrow the trigger wording to explicit epic-loop workspace operations."
    }
  ]
}
```

Allowed `status` values: `pass`, `fail`, `needs-review`.

Allowed `severity` values: `error`, `warning`, `info`.

The runner should treat malformed JSON, missing required fields, unknown schema versions, missing output files, or a failed `codex exec` invocation as a validation failure. This keeps the outer command deterministic even though one step is model-backed.

The generated output directory must be ignored by git. The runner may keep both `latest.json` and raw stdout/stderr logs for debugging, but committed source must not include generated AI review artifacts.

By default, this AI-backed check should not be part of `pnpm run validate` unless the maintainer explicitly accepts model-backed validation in CI. It should be a separate pre-release or maintainer review command.
