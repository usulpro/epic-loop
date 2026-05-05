# PrimeUI Exported Project

## Workflow

- Use `pnpm` for installs and scripts.
- Use the checked-in project scripts before finishing code changes:
  - `pnpm format`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm build`
- Start the local preview with `pnpm dev`.

## PrimeUI Integration

- PrimeUI project linkage lives in `.primeui/project.json`.
- PrimeUI CLI configures project-local AI tooling with `npx @primeuicom/cli ai-setup --ai-preset <agent>`.
- Interactive PrimeUI CLI setup can configure multiple AI presets; command flags accept one preset at a time.
- Codex stores PrimeUI MCP server entries in `.codex/config.toml`; Claude and Cursor also keep shared MCP definitions in `.mcp.json`.
- Keep agent configuration project-local and reversible. Do not modify user-global config from this repository.

## Claude Code Notes

- Claude Code reads repository instructions from `CLAUDE.md`.
- Project-local Claude settings live in `.claude/settings.json` after CLI AI setup.
- PrimeUI CLI installs shared MCP servers and public skills project-locally during AI setup.
- The user still needs a local Claude Code install/login.
