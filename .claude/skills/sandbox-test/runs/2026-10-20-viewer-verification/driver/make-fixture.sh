#!/usr/bin/env bash
# Builds the viewer fixture repo from the run 12 "mini" base commit: a pre-shaped 4-task epic (D-12),
# one human-queue item, one agent-made decision, a doc citing ids, a static review page, and the
# second language ru, all written by the worktree's own skill scripts. Usage: make-fixture.sh
main() {
set -euo pipefail
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop-visual
SCRIPTS=$REPO/plugins/epic-loop/skills/epic-loop/scripts
DRV=$REPO/.claude/skills/sandbox-test/runs/2026-10-20-viewer-verification/driver
BASE=$W/sandbox-logs/2026-10-20-doorbell-claude-e2e/fixture-E3
R=$W/sandbox-logs/2026-10-20-viewer-verification
D=$R/fixture
NODE="$(node -p process.execPath)"
rm -rf "${D:?}"
mkdir -p "$D"
git -C "$BASE" archive 84c0e71 | tar -x -C "$D"
cd "$D"
git init -q -b main
git config user.email sandbox@example.invalid
git config user.name Sandbox
E=.epic-loop/epics/mini
cp "$DRV/fixture/epic/tracker.md" "$DRV/fixture/epic/state-of-epic.md" "$E/"
cp "$DRV/fixture/epic/docs/"*.md "$E/docs/"
mkdir -p "$E/reviews/2026-10-20-package-name"
cp "$DRV/fixture/review/"* "$E/reviews/2026-10-20-package-name/"
"$NODE" "$SCRIPTS/human-queue.mjs" add --root "$D" --slug mini --kind human-action --ask "Pick the npm package name for the helpers" --why "only the human owns the published name" --blocks "a later publish step (not in Phase 1)" > /dev/null
"$NODE" "$SCRIPTS/agent-decision.mjs" add --root "$D" --slug mini --title "The helpers stay in one module" --default "src/index.mjs exports all three" --why "three one-line helpers do not need separate files" > /dev/null
"$NODE" "$SCRIPTS/set-second-language.mjs" --root "$D" --slug mini --lang ru > /dev/null
git add -A
git commit -qm "chore(epic): viewer verification fixture"
echo "fixture: $(git rev-parse --short HEAD)"
}
main "$@"
