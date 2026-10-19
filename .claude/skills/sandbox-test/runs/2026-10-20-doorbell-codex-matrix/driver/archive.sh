#!/usr/bin/env bash
# Archives every Codex matrix cell sandbox (git bundle with a restore test, .doorbell/, hook config, the
# cell's Codex rollouts), then removes the sandbox. Rollouts stay in ~/.codex/sessions (normal history).
main() {
set -euo pipefail
W=/projects/my-projects/epic-loop-workspace
R=$W/sandbox-logs/2026-10-20-doorbell-codex-matrix
SP="${SCRATCH:?set SCRATCH to a scratch dir for restore tests}"
for S in "$W"/sandbox-dbc-*; do
  CELL="${S##*/sandbox-dbc-}"
  OUT="$R/artifacts/$CELL"
  mkdir -p "$OUT/10-rollouts"
  git -C "$S" bundle create "$OUT/08-sandbox.bundle" --all 2> /dev/null
  rm -rf "${SP:?}/restore-$CELL"
  git clone -q "$OUT/08-sandbox.bundle" "$SP/restore-$CELL" && echo "$CELL bundle restore ok"
  rm -rf "${SP:?}/restore-$CELL"
  cp -r "$S/.doorbell" "$OUT/09-doorbell-dir"
  cp -r "$S/.codex" "$OUT/09-codex-config"
  grep -l "$S" "$HOME"/.codex/sessions/2026/10/20/*.jsonl | xargs -r cp -t "$OUT/10-rollouts"
  rm -rf "${S:?}"
done
rm -rf "${R:?}/qr-sock"
}
main "$@"
