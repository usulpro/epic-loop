#!/usr/bin/env bash
# Doorbell smoke run on Codex: fresh sandbox, kit installed for codex-queue, one interactive Codex TUI
# session (the TUI keeps the thread loaded) driven through ptydrive. The session registers its thread id
# and goes idle; this script then submits answers, the server rings `codex queue`, and the driver waits
# for the pickup. Cost guards: low reasoning effort, user MCP servers disabled, 10-minute timeout, and a
# watchdog that kills the session after MAX_STOPS Stop events. Default sandbox (workspace-write), no
# danger-full-access; trust is passed inline with -c, ~/.codex/config.toml is not edited.
set -euo pipefail
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop-visual
TOOLS=$REPO/.claude/skills/sandbox-test/tools
R=$W/sandbox-logs/2026-10-19-doorbell-smoke
S=$W/sandbox-doorbell-codex
OUT=$R/artifacts/codex-queue
NODE="$(node -p process.execPath)"
MAX_STOPS="${MAX_STOPS:-4}"
mkdir -p "$OUT"
rm -rf "$S"
mkdir -p "$S"
cd "$S"
git init -q -b main
git config user.email sandbox@example.invalid
git config user.name Sandbox
printf '# Doorbell probe sandbox\n' > README.md
git add README.md && git commit -qm "init"
"$NODE" "$TOOLS/doorbell/install.mjs" --sandbox "$S" --host codex --variant codex-queue > "$OUT/01-install.json"
cp "$S/.codex/hooks.json" "$OUT/01-hooks.json"
D="$S/.doorbell"
PLOG="$D/probe-log.jsonl"
touch "$PLOG"
TRUST="$("$NODE" "$TOOLS/codex-trust-args.mjs" "$S/.codex/hooks.json" "$S" | tr '\0' '\n')"
TRUST_HOOKS="$(printf '%s\n' "$TRUST" | sed -n 1p)"
TRUST_PROJECT="$(printf '%s\n' "$TRUST" | sed -n 2p)"
"$NODE" "$TOOLS/doorbell/server.mjs" --dir "$D" --ring codex-queue > "$OUT/02-server.txt" 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
PROMPT="Read .doorbell/probe.md and follow it exactly."
"$NODE" -e '
const [plog] = process.argv.slice(1);
console.log(JSON.stringify([
  { forbid: "(?i)update now|(?<!no )update available|skip until next version" },
  { expect_file: plog, pattern: "\"event\":\"register-thread\"", timeout: 240 },
  { expect_file: plog, pattern: "\"hookEvent\":\"Stop\"", timeout: 240 },
  { expect_file: plog, pattern: "\"event\":\"pickup\"", timeout: 300 },
  { wait: 30 }
], null, 1));' "$PLOG" > "$OUT/03-steps.json"
printf '%s\n' "$PROMPT" > "$OUT/03-prompt.txt"
if [ "${DRY_RUN:-0}" = 1 ]; then echo "dry run ok"; exit 0; fi
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR timeout 10m python3 "$TOOLS/ptydrive.py" "$OUT/03-steps.json" "$OUT/04-interactive-raw.log" -- \
  codex -C "$S" -m gpt-5.6-sol -c model_reasoning_effort=low -c check_for_update_on_startup=false \
  -s workspace-write -a never \
  -c mcp_servers.node_repl.enabled=false -c mcp_servers.Sanity.enabled=false \
  -c "$TRUST_HOOKS" -c "$TRUST_PROJECT" --no-alt-screen "$PROMPT" \
  > "$OUT/05-driver.txt" 2>&1 &
DRV=$!
# The human: wait until the thread is registered and the setup turn has ended, stay idle, then submit.
for i in $(seq 1 480); do
  grep -q '"event":"register-thread"' "$PLOG" && grep -q '"hookEvent":"Stop"' "$PLOG" && break
  kill -0 $DRV 2>/dev/null || break
  sleep 0.5
done
sleep 20
echo "submit at $(date -Is)" >> "$OUT/05-driver.txt"
"$NODE" "$TOOLS/doorbell/submit.mjs" --dir "$D" --answer "the doorbell answer is amber (codex-queue)" >> "$OUT/05-driver.txt" 2>&1 || true
# Watchdog on Stop events while the driver runs.
while kill -0 $DRV 2>/dev/null; do
  STOPS=$(grep -c '"hookEvent":"Stop"' "$PLOG" || true)
  if [ "${STOPS:-0}" -gt "$MAX_STOPS" ]; then
    echo "watchdog: $STOPS Stop events > $MAX_STOPS, stopping" >> "$OUT/05-driver.txt"
    kill $DRV 2>/dev/null || true
    break
  fi
  sleep 2
done
wait $DRV || echo "driver exit $?" >> "$OUT/05-driver.txt"
kill $SRV 2>/dev/null || true
date -Is >> "$OUT/05-driver.txt"
cp "$PLOG" "$OUT/06-probe-log.jsonl"
"$NODE" "$TOOLS/doorbell/summary.mjs" --dir "$D" > "$OUT/07-summary.txt" 2>&1 || true
echo "codex run done"
