# Changelog

## Unreleased

- Add `scripts/epic-loop.mjs` skill wrapper: runs the `epic-loop` npm CLI pinned to the skill version and passes the skill directory.
- Move `doctor` into the CLI (`epic-loop doctor`); it now also reports the skill version, install type, and available updates.
- Add `epic-loop install`, `epic-loop update`, and `epic-loop config` (machine-local `autoupdate`); the npm package ships a copy of the skill.
- Add Claude Code plugin and marketplace manifests.
- Add `pnpm run release <version>`: one version across skill, plugin manifests, and npm package; `validate` enforces it.

## 0.1.0

- Package `epic-loop` as a Codex plugin.
- Add Codex marketplace metadata.
- Keep the reusable skill under `plugins/epic-loop/skills/epic-loop/`.
- Move role prompt templates into `assets/templates/`.
