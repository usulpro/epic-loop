#!/usr/bin/env bash
# Archives the three cells into sandbox-logs (git bundle restore-tested, the .epic-loop tree with
# .runtime, the host transcripts and the Codex rollout), then removes the sandboxes, the Claude
# project directory of the sandbox and the scratch a11y copy. Usage: archive.sh
main() {
set -euo pipefail
W=/projects/my-projects/epic-loop-workspace
R=$W/sandbox-logs/2026-10-20-viewer-verification
SCRATCH=/tmp/claude-1000/-projects-my-projects-epic-loop-workspace-epic-loop-visual/9905589d-45b6-467a-8ea8-75a9c3fcb241/scratchpad
for C in claude codex epic; do
  S=$W/sandbox-viewer-$C
  OUT=$R/artifacts/$C
  [ -d "$S" ] || continue
  mkdir -p "$OUT/90-archive"
  if [ -d "$S/.git" ]; then
    git -C "$S" bundle create "$OUT/90-archive/sandbox.bundle" --all > /dev/null 2>&1
    T="$SCRATCH/restore-$C"
    rm -rf "${T:?}"
    git clone -q "$OUT/90-archive/sandbox.bundle" "$T" && (cd "$T" && npm test > "$OUT/90-archive/restore-test.txt" 2>&1 || echo "restore test failed" >> "$OUT/90-archive/restore-test.txt")
    rm -rf "${T:?}"
  fi
  tar -C "$S" -czf "$OUT/90-archive/epic-loop-tree.tgz" .epic-loop
  rm -rf "${S:?}"
done
P=$HOME/.claude/projects/-projects-my-projects-epic-loop-workspace-sandbox-viewer-claude
if [ -d "$P" ]; then
  tar -C "$HOME/.claude/projects" -czf "$R/artifacts/claude/90-archive/host-transcripts.tgz" "./$(basename "$P")"
  rm -rf "${P:?}"
fi
ROLL="$(node -p "require('$R/artifacts/codex/codex-check.json').transcript.path" 2>/dev/null || true)"
[ -n "$ROLL" ] && [ -f "$ROLL" ] && cp "$ROLL" "$R/artifacts/codex/90-archive/"
rm -rf "${SCRATCH:?}/a11y-fixture"
echo "archived"
}
main "$@"
