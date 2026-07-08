# Decision Log

## Active Decisions

- 2026-07-07: Split skill repository checks into two implementation phases. Mechanical skill package invariants should be enforced by deterministic scripts, while semantic skill quality review should run through a headless `codex exec --ephemeral` workflow wrapped by a repository script that requires structured JSON output in an ignored directory and validates that schema before reporting findings.
- 2026-07-07: Accept current oxlint `max-lines` failures in `plugins/epic-loop/skills/epic-loop/scripts/lib/loop.mjs` and `plugins/epic-loop/skills/epic-loop/scripts/lib/hooks.mjs` as known baseline debt for now. Do not relax the targeted limits; continue implementation and track a Phase 1 refactor task to split those modules before final phase verification.
- 2026-07-07: Scope Oxfmt formatting to JS/MJS and JSON config/source surfaces. Exclude markdown from the formatter command because `oxfmt@0.57.0` rewrote inline-code spacing and template placeholder emphasis unsafely in repository docs/templates during verification.
- 2026-07-07: Remove the repository English-only lexical validation phase. A real read-only audit found no Cyrillic, suspicious non-Latin scripts, or obvious non-English prose in the repository; remaining non-ASCII findings are punctuation and contract strings, so strict ASCII cleanup is not part of this epic.
- 2026-07-07: Add targeted oxlint maintainability limits: source files may contain up to 600 lines, test files may contain up to 900 lines, and individual functions may contain up to 150 lines. Configure these limits to skip blank lines and comment-only lines.
- 2026-07-06: Treat `pnpm run validate` as the durable aggregate validation entry point. New checks should be integrated there unless implementation finds a stronger existing convention.

## Historical Decisions

- Superseded 2026-07-07: Use oxlint for JavaScript/ESM linting, Oxfmt (`oxfmt`) for formatting, and a small repository-owned Node.js script for the English-only lexical policy. The custom script should cover repo-specific language policy with explicit include/ignore patterns and allowlists.
