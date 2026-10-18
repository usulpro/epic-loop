# Delivery: Where Each Phase Runs And How It Merges

Read this before starting or resuming any phase of this epic. Decision: D18.

## Repository

- Main checkout: `/projects/my-projects/epic-loop-workspace/epic-loop` (the epic-loop development repo; see its `CLAUDE.md`).
- Edit the skill in `plugins/epic-loop/skills/epic-loop/` and the CLI in `packages/cli/`, never the runtime copies.
- Run `pnpm run test:unit` and `pnpm run validate` before every task commit.
- **Epic artifacts are committed.** The human-facing files under `.epic-loop/epics/visual-review/` are tracked in git, like the other epics in this repo. Task commits include the epic artifact updates of that task. `.runtime/` folders are gitignored and never committed.
  - The repo `CLAUDE.md` line "Never commit anything under `.epic-loop/`" is outdated for human-facing epic files; follow this section.

## Phase 1: Main Checkout, Own Branch, Merged Into `main` First

- **Where:** the main checkout, on branch `feature/manager-stop-gate`, created from `main`.
- **First step:** create the branch, then commit the epic's shaping artifacts as the branch's first commit: `chore(epic): shape visual-review epic`.
- **Setup before the implementation loop** (once; the main checkout has no hooks yet):
  - `node .claude/skills/epic-loop/scripts/install-hooks.mjs`, after `doctor --platform claude-code` (or `codex`);
  - set `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0`, for example in `.claude/settings.json` under `env`;
  - rerun `doctor` until it reports `ready`.
- **Merge:**
  - When the Phase 1 verification task is done, the techlead opens a pull request from `feature/manager-stop-gate` to `main` and stops the loop for the human's review.
  - The human (or a session the human asks) squash-merges it.
  - The agent never merges, pushes to `main`, or publishes to npm on its own.
- **After the merge:** in the main checkout, `git checkout main && git pull`, then `pnpm run self-update`, so the runtime copies carry the stop gate.
- **No release is part of this epic's flow.** A release goes through the `/release-epic` skill when the human decides. The release order rule in `CLAUDE.md` applies.

## Phases 2–7: Separate Worktree, One Feature Branch

- **When:** only after Phase 1 is merged into `main`.
- **Create the worktree:**
  - `git -C /projects/my-projects/epic-loop-workspace/epic-loop worktree add ../epic-loop-visual -b feature/visual-review main`;
  - the worktree path is `/projects/my-projects/epic-loop-workspace/epic-loop-visual`.
- **Set up the worktree** (runtime copies, hooks and settings are gitignored, so they do not come with git):
  - `pnpm install`;
  - `pnpm run self-update`;
  - `doctor --platform <platform>`, `install-hooks.mjs`, `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0`, then `doctor` again until it reports `ready`.
- **The epic lives in the worktree from then on:**
  - the worktree's copy of `.epic-loop/epics/visual-review/` (it arrives with git from `main`) is the source of truth for Phases 2–7;
  - sessions for this epic run in the worktree, not in the main checkout;
  - the main checkout's copy is not edited until the merge brings it back.
- **Merge:** one pull request from `feature/visual-review` to `main` when Phase 5 is verified. That is the usable visual layer. Phases 6 and 7 continue on a new branch from `main` after that, unless the human decides otherwise. The same rule applies: the agent opens the PR and stops; the human merges.
- Keep the branch current with `main` by rebasing or merging `main` at phase boundaries, not mid-task.

## Do Not Change The Running Loop Under Itself

- The implementation loop of this epic runs the runtime copy `.claude/skills/epic-loop/` (or `.codex/skills/epic-loop/`) of the checkout it runs in.
- Phases 1, 2 and 4 change the loop itself. **Never run `pnpm run self-update` while this epic's loop is running.** A mid-run update replaces the hook code under the live loop.
- Verify loop changes with unit tests and in disposable sandboxes (`.claude/skills/sandbox-test`), which install the skill from source through the local CLI (`EPIC_LOOP_CLI=<checkout>/packages/cli/src/cli.mjs`).
- Update the runtime copy only while the loop is stopped, for example after a merge, or when the human asks to dogfood a finished phase.
