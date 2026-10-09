---
name: release-epic
description: Release a new version of epic-loop (npm CLI + skill + plugin manifests) from this repository. Runs every release step except the manual `npm publish`, waits for the publish to land, then tags, pushes, and syncs the runtime skill copies. Use only when the user asks to release, cut, or publish an epic-loop version.
argument-hint: "[x.y.z | patch | minor | major]"
disable-model-invocation: true
---

# Release epic-loop

The user's only job is to start this skill, run `npm publish` when told, and wait. Everything else is driven by `scripts/release.mjs`; never re-implement its steps by hand.

Run every command from the repository root. Talk to the user in their language; anything written to the repo (changelog entries, commit messages) is English.

## 1. Pick the version

- If `$ARGUMENTS` is a version or `patch`/`minor`/`major`, use it.
- Otherwise choose yourself: `minor` if the unreleased changes add commands, features, or behavior; `patch` for fixes and docs only. State the choice in one line and continue; do not ask.

## 2. Make the changelog describe the release

`CHANGELOG.md` must have a `## Unreleased` section listing every user-visible change since the last release. Compare it with:

```bash
git log --oneline "$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)"..HEAD
```

Add missing entries as short English bullets. Do not commit: `prepare` folds `CHANGELOG.md` into the release commit and renames the heading to the version.

## 3. Prepare

```bash
node scripts/release.mjs prepare <version|patch|minor|major>
```

It refuses to run unless it is on an up-to-date, clean `main` (only `CHANGELOG.md` may be edited), npm is logged in as an owner of `epic-loop`, and the version is neither tagged nor published yet. If npm login is the problem, tell the user to run `npm login` and rerun `prepare`. Then it stamps the version everywhere, runs `pnpm run validate` and the full unit suite, builds the package, checks the packed tarball, and creates the local commit `release: v<version>`. Nothing is pushed. Allow up to 10 minutes.

On failure the script restores the versioned files and the changelog by itself. Report the failing step and the key error in two or three lines and stop. Do not fix code inside the release flow unless the user asks.

## 4. Hand off the publish, then wait

Tell the user, in one short message, the single thing to do:

```bash
cd packages/cli && npm publish
```

Right after that message, start the waiter as a background command (Bash with `run_in_background`) and end the turn without polling:

```bash
node scripts/release.mjs wait <version>
```

It exits 0 as soon as npm serves `epic-loop@<version>`, or fails after 60 minutes.

## 5. Finish

When the waiter exits successfully:

```bash
node scripts/release.mjs finish <version>
```

It smoke-tests `npx epic-loop@<version>`, pushes `main`, tags `v<version>`, pushes the tag, creates the GitHub Release (notes = the version's changelog section), runs the runtime skill sync (`self-update`), verifies the `.claude`/`.codex` copies match the source, and runs doctor through the runtime copy against the published CLI.

Report a short summary: version, tag pushed, runtime copies verified.

- Failure before the push (npm smoke): safe to rerun `finish` once the cause is fixed or npm propagation catches up.
- Failure after the push (sync, diff, doctor smoke): the release is live; report exactly which post-release check failed.
- Waiter timed out: ask whether the publish happened. If yes, run `finish`; if the user wants to stop, abort.

## Cancel before publishing

If the user cancels before `npm publish`:

```bash
node scripts/release.mjs abort <version>
```

It drops the local release commit, restores the versions, and turns the changelog heading back into `## Unreleased`. It refuses once the version is on npm.

## Rules

- Never run `npm publish` yourself, and never push before `finish`.
- Never edit version fields by hand; `scripts/release.mjs` owns them.
- Publishing to npm must come before any push: the skill on `main` pins the new version.
- Release tags and GitHub Releases live on `main` only. Temporary tags on a feature branch are fine during development; they are expected to disappear with the squash merge. If a release had to be cut from a branch (`EPIC_LOOP_RELEASE_BRANCH`), `finish` skips the tag and the GitHub Release; put both on the squash-merge commit on `main` afterwards.
- Major version: stay on 0.x until most skill scripts run through the npm CLI (`standalone-npx` Phase 5), then release `1.0.0`.
