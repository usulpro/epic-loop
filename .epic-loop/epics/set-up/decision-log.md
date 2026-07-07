# Decision Log

## Active Decisions

- 2026-07-07: Add targeted oxlint maintainability limits: source files may contain up to 600 lines, test files may contain up to 900 lines, and individual functions may contain up to 150 lines. Configure these limits to skip blank lines and comment-only lines.
- 2026-07-06: Use oxlint for JavaScript/ESM linting, Oxfmt (`oxfmt`) for formatting, and a small repository-owned Node.js script for the English-only lexical policy. The custom script should cover repo-specific language policy with explicit include/ignore patterns and allowlists.
- 2026-07-06: Treat `pnpm run validate` as the durable aggregate validation entry point. New checks should be integrated there unless implementation finds a stronger existing convention.

## Historical Decisions

- None recorded yet.
