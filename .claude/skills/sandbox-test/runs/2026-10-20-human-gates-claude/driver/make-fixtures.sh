#!/usr/bin/env bash
# Builds the two fixture repos (G: gates, S: stop report) from the run 12 "mini" base commit, with the
# human queue and decision log written by the worktree's own scripts. Usage: make-fixtures.sh
main() {
set -euo pipefail
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop-visual
SCRIPTS=$REPO/plugins/epic-loop/skills/epic-loop/scripts
DRV=$REPO/.claude/skills/sandbox-test/runs/2026-10-20-human-gates-claude/driver
BASE=$W/sandbox-logs/2026-10-20-doorbell-claude-e2e/fixture-E3
R=$W/sandbox-logs/2026-10-20-human-gates-claude
NODE="$(node -p process.execPath)"
mkdir -p "$R"
for F in G S; do
  D="$R/fixture-$F"
  rm -rf "${D:?}"
  mkdir -p "$D"
  git -C "$BASE" archive 84c0e71 | tar -x -C "$D"
  cd "$D"
  git init -q -b main
  git config user.email sandbox@example.invalid
  git config user.name Sandbox
  cp "$DRV/fixture-$F/tracker.md" .epic-loop/epics/mini/tracker.md
  cp "$DRV/fixture-$F/state-of-epic.md" .epic-loop/epics/mini/state-of-epic.md
  Q() { "$NODE" "$SCRIPTS/human-queue.mjs" add --root "$D" --slug mini "$@" > /dev/null; }
  if [ "$F" = G ]; then
    Q --kind product-decision --ask "Greeting punctuation: end greet() output with '!' or '.'" --why "the product voice" --blocks "phase-1-task-1" --default "!"
    Q --kind human-action --ask "Confirm the release name 'Mini 1.0' for RELEASE.md" --why "only the human owns the release name" --blocks "phase-1-task-2"
    Q --kind security-hold --ask "Allow 'npm publish' for this package (a guard stopped it)" --why "publishing is irreversible" --blocks "a later publish task"
  else
    Q --kind human-action --ask "Add the NPM_TOKEN secret to the CI settings" --why "the release workflow needs it; the agent cannot set CI secrets" --blocks "phase-1-task-1"
    "$NODE" "$SCRIPTS/agent-decision.mjs" add --root "$D" --slug mini --title "The release workflow runs on version tags only" --default "on: push tags v*" --why "releases are cut from tags" > /dev/null
  fi
  git add -A
  git commit -qm "chore(epic): human gates fixture $F"
  echo "fixture $F: $(git rev-parse --short HEAD)"
done
}
main "$@"
