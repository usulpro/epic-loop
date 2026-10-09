# Changelog

## 0.2.1

- `doctor` now offers the update (and runs autoupdate when enabled) for pre-wrapper skill copies that have no version; they were previously treated as up to date.
- `doctor` on Claude Code no longer suggests rerunning `install-hooks` when the hooks are installed and only `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` is missing.

## 0.2.0

- Add `scripts/epic-loop.mjs` skill wrapper: runs the `epic-loop` npm CLI pinned to the skill version and passes the skill directory.
- Move `doctor` into the CLI (`epic-loop doctor`); it now also reports the skill version, install type, and available updates.
- Add `epic-loop install`, `epic-loop update`, and `epic-loop config` (machine-local `autoupdate`); the npm package ships a copy of the skill.
- Add Claude Code plugin and marketplace manifests.
- Add `scripts/release.mjs` (`stamp`/`prepare`/`wait`/`finish`/`abort`) and the repo-local `/release-epic` Claude Code skill: one version across skill, plugin manifests, and npm package (`validate` enforces it); the only manual release step is `npm publish`.

## 0.1.0

- Package `epic-loop` as a Codex plugin.
- Add Codex marketplace metadata.
- Keep the reusable skill under `plugins/epic-loop/skills/epic-loop/`.
- Move role prompt templates into `assets/templates/`.
