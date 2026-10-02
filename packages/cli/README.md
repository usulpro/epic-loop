# epic-loop

CLI for [epic-loop](https://github.com/usulpro/epic-loop) — long-lived engineering epics tracked across agent sessions. The package also ships the epic-loop skill itself, so it can install and update project-local skill copies.

## Usage

```bash
npx epic-loop                                   # list epics in the current project
npx epic-loop install --platform claude-code    # skill -> .claude/skills/epic-loop, hooks -> .claude/settings.json
npx epic-loop install --platform codex          # skill -> .codex/skills/epic-loop, hooks -> .codex/hooks.json
npx epic-loop doctor --platform claude-code     # hooks, epic state, skill version, available updates [--json]
npx epic-loop@latest update                     # replace a local skill copy with the latest release
npx epic-loop config set autoupdate true        # let doctor update local skill copies automatically
```

Inside agent sessions the skill calls the CLI through its own wrapper, `node <skill-dir>/scripts/epic-loop.mjs <command>`, which pins the CLI to the skill's version and tells the CLI where the skill lives. Running the CLI directly discovers the skill in `.claude/skills/`, `.codex/skills/`, `.agents/skills/`, the user-level equivalents, or installed Claude Code plugins; `--skill-dir <path>` overrides discovery.

Plugin installs (Codex or Claude Code marketplaces) are updated by their host, not by this CLI; `doctor` prints the right host command.

## Environment

| Variable | Effect |
|---|---|
| `EPIC_LOOP_CLI` | Path to a local `src/cli.mjs`; the skill wrapper runs it instead of `npx epic-loop@<version>` (development) |
| `EPIC_LOOP_NO_UPDATE_CHECK=1` | Skip the npm registry update check |
| `EPIC_LOOP_REGISTRY_URL` | Registry used for the update check (default `https://registry.npmjs.org`) |
