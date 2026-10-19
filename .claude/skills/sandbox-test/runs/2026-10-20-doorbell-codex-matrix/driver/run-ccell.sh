#!/usr/bin/env bash
# Usage: run-ccell.sh <QB|QD|QE|QF|QR|FA>. One fresh sandbox per Codex cell; the interactive Codex TUI is
# driven through ptydrive. Guards: low reasoning effort, the user's MCP servers disabled, a timeout, and a
# watchdog on Stop events. Default sandbox (workspace-write); trust is passed inline, ~/.codex/config.toml
# is not edited. QR runs its own app server on a private unix socket (never the shared daemon).
main() {
set -euo pipefail
CELL="$1"
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop-visual
TOOLS=$REPO/.claude/skills/sandbox-test/tools
KIT_SRC=$TOOLS/doorbell
DRV=$REPO/.claude/skills/sandbox-test/runs/2026-10-20-doorbell-codex-matrix/driver
R=$W/sandbox-logs/2026-10-20-doorbell-codex-matrix
S=$W/sandbox-dbc-$CELL
OUT=$R/artifacts/$CELL
NODE="$(node -p process.execPath)"
MAX_STOPS="${MAX_STOPS:-5}"
mkdir -p "$OUT"
rm -rf "${S:?}"
mkdir -p "$S"
cd "$S"
git init -q -b main
printf '# Doorbell Codex matrix sandbox\n' > README.md
git add README.md
git -c user.email=sandbox@example.invalid -c user.name=Sandbox commit -qm init
VARIANT=codex-queue; RING=codex-queue
[ "$CELL" = FA ] && VARIANT=fallback-only && RING=file
"$NODE" "$KIT_SRC/install.mjs" --sandbox "$S" --host codex --variant "$VARIANT" > "$OUT/01-install.json"
cp "$S/.codex/hooks.json" "$OUT/01-hooks.json"
D="$S/.doorbell"
export PLOG="$D/probe-log.jsonl" NODE KIT="$D/kit" DIR="$D"
touch "$PLOG"
TRUST="$("$NODE" "$TOOLS/codex-trust-args.mjs" "$S/.codex/hooks.json" "$S" | tr '\0' '\n')"
TRUST_HOOKS="$(printf '%s\n' "$TRUST" | sed -n 1p)"
TRUST_PROJECT="$(printf '%s\n' "$TRUST" | sed -n 2p)"
REMOTE=()
APPSRV=""
if [ "$CELL" = QR ]; then
  # The app server requires a private socket directory (owned by the user, mode 0700).
  SOCKDIR="$R/qr-sock"
  rm -rf "${SOCKDIR:?}"
  mkdir -m 700 "$SOCKDIR"
  SOCK="$SOCKDIR/app-server.sock"
  # setsid: the codex shim is a node wrapper (Volta); killing its process group also stops the real server.
  setsid codex app-server --listen "unix://$SOCK" -c mcp_servers.node_repl.enabled=false -c mcp_servers.Sanity.enabled=false -c check_for_update_on_startup=false -c "$TRUST_HOOKS" -c "$TRUST_PROJECT" > "$OUT/02-app-server.txt" 2>&1 &
  APPSRV=$!
  for i in $(seq 1 40); do [ -S "$SOCK" ] && break; sleep 0.5; done
  REMOTE=(--remote "unix://$SOCK")
  echo "app server pid $APPSRV on $SOCK" >> "$OUT/05-driver.txt"
fi
SRV_ARGS=(--dir "$D" --ring "$RING")
"$NODE" "$KIT_SRC/server.mjs" "${SRV_ARGS[@]}" > "$OUT/02-server.txt" 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true; [ -n "${APPSRV:-}" ] && kill -- -"$APPSRV" 2>/dev/null || true' EXIT
PROMPT="Read .doorbell/probe.md and follow it exactly."
[ "$CELL" = FA ] && PROMPT="Read .doorbell/probe.md and follow it exactly. Skip the register-thread step: there is no queue in this probe."
printf '%s\n' "$PROMPT" > "$OUT/03-prompt.txt"
CODEX_FLAGS=(-C "$S" -m gpt-5.6-sol -c model_reasoning_effort=low -c check_for_update_on_startup=false
  -s workspace-write -a never -c mcp_servers.node_repl.enabled=false -c mcp_servers.Sanity.enabled=false
  -c "$TRUST_HOOKS" -c "$TRUST_PROJECT" --no-alt-screen)
watchdog() { # <pid>
  while kill -0 "$1" 2>/dev/null; do
    STOPS=$(grep -c '"hookEvent":"Stop"' "$PLOG" || true)
    if [ "${STOPS:-0}" -gt "$MAX_STOPS" ]; then echo "watchdog: $STOPS Stop events > $MAX_STOPS" >> "$OUT/05-driver.txt"; kill "$1" 2>/dev/null || true; fi
    sleep 2
  done
}
drive() { # <steps> <raw> <codex args...>
  local steps="$1" raw="$2"; shift 2
  env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR timeout 25m python3 "$TOOLS/ptydrive.py" "$steps" "$raw" -- codex "$@" >> "$OUT/05-driver.txt" 2>&1 &
  local pid=$!
  watchdog $pid &
  wait $pid || echo "driver exit $?" >> "$OUT/05-driver.txt"
}
date -Is >> "$OUT/05-driver.txt"
if [ "$CELL" = QF ]; then
  "$NODE" "$DRV/make-steps.mjs" QF 1 > "$OUT/03-steps-1.json"
  drive "$OUT/03-steps-1.json" "$OUT/04-raw-1.log" "${CODEX_FLAGS[@]}" "$PROMPT"
  sleep 3
  echo "TUI closed at $(date -Is); queueing while closed" >> "$OUT/05-driver.txt"
  "$NODE" "$KIT_SRC/submit.mjs" --dir "$D" --answer "answer for codex cell QF (submitted while closed)" >> "$OUT/05-driver.txt" 2>&1
  sleep 3
  TID=$(cat "$D/thread-id")
  echo "resuming $TID at $(date -Is)" >> "$OUT/05-driver.txt"
  "$NODE" "$DRV/make-steps.mjs" QF 2 > "$OUT/03-steps-2.json"
  drive "$OUT/03-steps-2.json" "$OUT/04-raw-2.log" resume "$TID" "${CODEX_FLAGS[@]}"
else
  "$NODE" "$DRV/make-steps.mjs" "$CELL" > "$OUT/03-steps.json"
  drive "$OUT/03-steps.json" "$OUT/04-raw.log" "${REMOTE[@]+"${REMOTE[@]}"}" "${CODEX_FLAGS[@]}" "$PROMPT"
fi
kill $SRV 2>/dev/null || true
[ -n "$APPSRV" ] && kill -- -"$APPSRV" 2>/dev/null || true
date -Is >> "$OUT/05-driver.txt"
cp "$PLOG" "$OUT/06-probe-log.jsonl"
"$NODE" "$KIT_SRC/summary.mjs" --dir "$D" > "$OUT/07-summary.txt" 2>&1 || true
echo "cell $CELL done"
}
main "$@"
