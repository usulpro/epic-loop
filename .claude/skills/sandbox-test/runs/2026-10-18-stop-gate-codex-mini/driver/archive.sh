#!/usr/bin/env bash
# Archives the sandbox per D-5, restore-tests the bundle, then removes the sandbox and its transcripts.
set -euo pipefail
W=/projects/my-projects/epic-loop-workspace
S=$W/sandbox-stop-gate-codex-mini
# Codex keeps no per-project transcript dir; rollouts are copied separately.
OUT=$W/sandbox-logs/2026-10-18-stop-gate-codex-mini/artifacts/90-archive
mkdir -p "$OUT"
git -C "$S" diff > "$OUT/uncommitted.diff" || true
git -C "$S" status --short > "$OUT/git-status.txt"
git -C "$S" log --oneline > "$OUT/git-log.txt"
git -C "$S" bundle create -q "$OUT/repo.bundle" --all
git -C "$S" bundle verify -q "$OUT/repo.bundle"
cp -r "$S/.epic-loop" "$OUT/epic-loop-state"
cp -r "$S/.codex" "$OUT/codex-config"; rm -rf "$OUT/codex-config/skills"

CHK=$(mktemp -d /tmp/claude-1000/restore-XXXX)
git clone -q "$OUT/repo.bundle" "$CHK/r"
(cd "$CHK/r" && npm test 2>&1 | grep -E '^ℹ (tests|pass|fail)') > "$OUT/restore-test.txt"
rm -rf "$CHK"
cat "$OUT/restore-test.txt"
rm -rf "$S"
echo "archived and removed $S"
