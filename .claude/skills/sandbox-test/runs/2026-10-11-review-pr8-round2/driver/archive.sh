#!/usr/bin/env bash
# Usage: archive.sh <A|B|C>. Archives a scenario sandbox per D-5, restore-tests the bundle, then removes it.
set -euo pipefail
X="$1"
W=/projects/my-projects/epic-loop-workspace
S=$W/sandbox-review-pr8-r2-$X
T=$HOME/.claude/projects/-projects-my-projects-epic-loop-workspace-sandbox-review-pr8-r2-$X
OUT=$W/sandbox-logs/2026-10-11-review-pr8-round2/artifacts/${TAG:+$TAG-}$X/90-archive
mkdir -p "$OUT"
cd "$S"
git -C "$S" diff > "$OUT/uncommitted.diff" || true
git -C "$S" status --short > "$OUT/git-status.txt"
git -C "$S" log --oneline > "$OUT/git-log.txt"
git bundle create -q "$OUT/repo.bundle" --all
git bundle verify "$OUT/repo.bundle" > /dev/null
cp -r "$S/.epic-loop" "$OUT/epic-loop-state"
cp "$S/.claude/settings.json" "$OUT/claude-settings.json"
cp -r "$S/.sandbox" "$OUT/sandbox-markers" 2>/dev/null || true
cp -r "$T" "$OUT/host-transcript"
CHK=$(mktemp -d /tmp/claude-1000/restore-XXXX)
git clone -q "$OUT/repo.bundle" "$CHK/r"
(cd "$CHK/r" && npm test 2>&1 | grep -E '^ℹ (tests|pass|fail)') > "$OUT/restore-test.txt"
rm -rf "$CHK"
cat "$OUT/restore-test.txt"
rm -rf "$S" "$T"
echo "archived and removed $X"
