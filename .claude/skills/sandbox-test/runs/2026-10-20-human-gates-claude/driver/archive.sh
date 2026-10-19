#!/usr/bin/env bash
# Archives every human-gates cell sandbox (git bundle with a restore test, .epic-loop/, hook config, host
# transcript), then removes the sandbox and its transcript dir. Usage: SCRATCH=<dir> archive.sh
set -euo pipefail
W=/projects/my-projects/epic-loop-workspace
R=$W/sandbox-logs/2026-10-20-human-gates-claude
SP="${SCRATCH:?set SCRATCH to a scratch dir for restore tests}"
for S in "$W"/sandbox-hg-*; do
  CELL="${S##*/sandbox-hg-}"
  OUT="$R/artifacts/$CELL"
  mkdir -p "$OUT"
  git -C "$S" add -A > /dev/null 2>&1 || true
  git -C "$S" -c user.email=s@x.invalid -c user.name=S commit -qm "archive: state after the run" > /dev/null 2>&1 || true
  git -C "$S" bundle create "$OUT/08-sandbox.bundle" --all 2> /dev/null
  rm -rf "${SP:?}/restore-$CELL"
  git clone -q "$OUT/08-sandbox.bundle" "$SP/restore-$CELL" && echo "$CELL bundle restore ok"
  rm -rf "${SP:?}/restore-$CELL"
  cp -r "$S/.epic-loop" "$OUT/09-epic-loop"
  cp "$S/.claude/settings.json" "$OUT/09-settings.json"
  T="$HOME/.claude/projects/$(printf '%s' "$S" | tr '/.' '--')"
  [ -d "$T" ] && cp -r "$T" "$OUT/10-host-transcript" || true
  rm -rf "${S:?}"
  [ -d "$T" ] && rm -rf "${T:?}" || true
done
