#!/usr/bin/env bash
# Minimal Codex check of the stop-gate role mechanics (run 8): one headless session on a 3-task
# epic (publish needs the human; one independent task; a verification task), with cost guards:
# low reasoning effort, no user config (no MCP servers), a 15-minute timeout and a watchdog that
# kills the session after MAX_TURNS role turns.
set -euo pipefail
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop
R=$W/sandbox-logs/2026-10-18-stop-gate-codex-mini
D=$REPO/.claude/skills/sandbox-test/runs/2026-10-18-stop-gate-codex-mini/driver
S=$W/sandbox-stop-gate-codex-mini
OUT=$R/artifacts
TOOLS=$REPO/.claude/skills/sandbox-test/tools
NODE="$(node -p process.execPath)"
MAX_TURNS="${MAX_TURNS:-14}"
PLOG="$S/.epic-loop/epics/mini/.runtime/progress-log.jsonl"
mkdir -p "$OUT"
rm -rf "$S"
git clone -q "$R/fixture" "$S"
cd "$S"
git config user.email sandbox@example.invalid
git config user.name Sandbox
git remote remove origin
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR \
  "$NODE" "$REPO/packages/cli/src/cli.mjs" install --platform codex > "$OUT/01-install.txt" 2>&1
diff -rq -x .runtime .codex/skills/epic-loop "$REPO/plugins/epic-loop/skills/epic-loop" >> "$OUT/01-install.txt" 2>&1 && echo "skill copy identical" >> "$OUT/01-install.txt"
printf '[features]\nhooks = true\n' >> .codex/config.toml
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR \
  "$NODE" .codex/skills/epic-loop/scripts/epic-loop.mjs doctor --platform codex --json > "$OUT/02-doctor.json" 2>&1 || true
cp "$D/prompt.txt" "$OUT/03-prompt.txt"
TRUST="$("$NODE" "$TOOLS/codex-trust-args.mjs" "$S/.codex/hooks.json" "$S" | tr '\0' '\n')"
TRUST_HOOKS="$(printf '%s\n' "$TRUST" | sed -n 1p)"
TRUST_PROJECT="$(printf '%s\n' "$TRUST" | sed -n 2p)"
if [ "${DRY_RUN:-0}" = 1 ]; then
  echo "dry run: doctor $(grep -o '"status": *"[a-z-]*"' "$OUT/02-doctor.json" | head -1)"
  exit 0
fi
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR timeout 15m \
  codex exec --ignore-user-config -C "$S" -m gpt-5.6-sol \
  -c model_reasoning_effort=low -c check_for_update_on_startup=false \
  -s danger-full-access -c approval_policy=never \
  -c "$TRUST_HOOKS" -c "$TRUST_PROJECT" \
  --json "$(cat "$D/prompt.txt")" < /dev/null > "$OUT/06-session.jsonl" 2> "$OUT/06-session.stderr" &
CODEX=$!
# Watchdog: stop the session once it has started more than MAX_TURNS role turns.
while kill -0 "$CODEX" 2>/dev/null; do
  TURNS=$(grep -c '"action":"turn-start"' "$PLOG" 2>/dev/null || true)
  if [ "${TURNS:-0}" -gt "$MAX_TURNS" ]; then
    echo "watchdog: $TURNS role turns > $MAX_TURNS, stopping the session" >> "$OUT/06-session.stderr"
    kill "$CODEX" 2>/dev/null || true
    pkill -P "$CODEX" 2>/dev/null || true
    break
  fi
  sleep 2
done
wait "$CODEX" 2>/dev/null || echo "session exit $?" >> "$OUT/06-session.stderr"
date -Is >> "$OUT/06-session.stderr"
echo "session done"
