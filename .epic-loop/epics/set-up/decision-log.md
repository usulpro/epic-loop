# Decision Log

## Active Decisions

- 2026-07-06: Use oxlint for JavaScript/ESM linting, Prettier for formatting, and a small repository-owned Node.js script for the English-only lexical policy. The custom script should cover repo-specific language policy with explicit include/ignore patterns and allowlists.
- 2026-07-06: Treat `pnpm run validate` as the durable aggregate validation entry point. New checks should be integrated there unless implementation finds a stronger existing convention.

## Historical Decisions

- None recorded yet.
