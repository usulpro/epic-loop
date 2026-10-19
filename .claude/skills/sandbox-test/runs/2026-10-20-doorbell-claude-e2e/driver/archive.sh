#!/usr/bin/env bash
# Archives every end-to-end scenario sandbox (git bundle with a restore test, .doorbell/, hook config,
# .epic-loop/ for loop cells, host transcript), then removes the sandbox and its transcript dir.
set -euo pipefail
W=/projects/my-projects/epic-loop-workspace
R=$W/sandbox-logs/2026-10-20-doorbell-claude-e2e
SP="${SCRATCH:?set SCRATCH to a scratch dir for restore tests}"
for S in "$W"/sandbox-dbe-*; do
  CELL="${S##*/sandbox-dbe-}"
  OUT="$R/artifacts/$CELL"
  mkdir -p "$OUT"
  git -C "$S" bundle create "$OUT/08-sandbox.bundle" --all 2> /dev/null
  rm -rf "${SP:?}/restore-$CELL"
  git clone -q "$OUT/08-sandbox.bundle" "$SP/restore-$CELL" && echo "$CELL bundle restore ok"
  rm -rf "${SP:?}/restore-$CELL"
  cp -r "$S/.doorbell" "$OUT/09-doorbell-dir"
  cp -r "$S/.claude/settings.json" "$OUT/09-settings.json"
  [ -d "$S/.epic-loop" ] && cp -r "$S/.epic-loop" "$OUT/09-epic-loop" || true
  T="$HOME/.claude/projects/$(printf '%s' "$S" | tr '/' '-')"
  [ -d "$T" ] && cp -r "$T" "$OUT/10-host-transcript" || true
  rm -rf "${S:?}" "${T:?}"
done
