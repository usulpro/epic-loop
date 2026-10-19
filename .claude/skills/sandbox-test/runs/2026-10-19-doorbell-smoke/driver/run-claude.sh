#!/usr/bin/env bash
# Usage: run-claude.sh <rewake-event|rewake-session|background>. Doorbell smoke run on Claude Code:
# fresh sandbox, kit installed for one variant, one interactive session driven through ptydrive.
# The session arms the waiter and goes idle; this script then submits answers through the answers
# server and the driver waits for the pickup the woken turn writes.
set -euo pipefail
V="$1"
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop-visual
TOOLS=$REPO/.claude/skills/sandbox-test/tools
R=$W/sandbox-logs/2026-10-19-doorbell-smoke
S=$W/sandbox-doorbell-claude-$V
OUT=$R/artifacts/claude-$V
NODE="$(node -p process.execPath)"
mkdir -p "$OUT"
rm -rf "$S"
mkdir -p "$S"
cd "$S"
git init -q -b main
git config user.email sandbox@example.invalid
git config user.name Sandbox
printf '# Doorbell probe sandbox\n' > README.md
git add README.md && git commit -qm "init"
"$NODE" "$TOOLS/doorbell/install.mjs" --sandbox "$S" --host claude-code --variant "$V" --fallback > "$OUT/01-install.json"
cp "$S/.claude/settings.json" "$OUT/01-settings.json"
D="$S/.doorbell"
PLOG="$D/probe-log.jsonl"
touch "$PLOG"
"$NODE" "$TOOLS/doorbell/server.mjs" --dir "$D" --ring file > "$OUT/02-server.txt" 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
PROMPT="Read .doorbell/probe.md and follow it exactly."
MECH=$([ "$V" = background ] && echo run_in_background || echo "asyncRewake")
"$NODE" -e '
const [plog, prompt, mech] = process.argv.slice(1);
const type = (t) => [{ send: t }, { wait: 1 }, { key: "enter" }];
console.log(JSON.stringify([
  { expect: "trust", timeout: 30 }, { wait: 1 }, { key: "down" }, { wait: 1 }, { key: "enter" },
  { forbid: "(?i)(?<!no )update available|auto-update" },
  { expect: "shift\\+tab\\s*to\\s*cycle", timeout: 60 }, { wait: 2 },
  ...type(prompt),
  { expect_file: plog, pattern: "\"waiter-armed\".*" + mech, timeout: 240 },
  { expect_file: plog, pattern: "\"hookEvent\":\"Stop\"", timeout: 240 },
  { expect_file: plog, pattern: "\"event\":\"pickup\"", timeout: 420 },
  { wait: 30 }
], null, 1));' "$PLOG" "$PROMPT" "$MECH" > "$OUT/03-steps.json"
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR -u CLAUDE_CODE_STOP_HOOK_BLOCK_CAP CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1 \
  timeout 15m python3 "$TOOLS/ptydrive.py" "$OUT/03-steps.json" "$OUT/04-interactive-raw.log" -- \
  claude --model sonnet --setting-sources project --permission-mode dontAsk \
  --allowedTools Read "Bash(node:*)" \
  > "$OUT/05-driver.txt" 2>&1 &
DRV=$!
# The human: wait until the waiter is armed and the setup turn has ended, stay idle a while, then submit.
for i in $(seq 1 480); do
  grep -q '"waiter-armed".*'"$MECH" "$PLOG" && grep -q '"hookEvent":"Stop"' "$PLOG" && break
  sleep 0.5
done
sleep 20
echo "submit at $(date -Is)" >> "$OUT/05-driver.txt"
"$NODE" "$TOOLS/doorbell/submit.mjs" --dir "$D" --answer "the doorbell answer is teal ($V)" >> "$OUT/05-driver.txt" 2>&1
wait $DRV || echo "driver exit $?" >> "$OUT/05-driver.txt"
kill $SRV 2>/dev/null || true
# Leftover waiters (an event hook re-arms after the pickup turn): kill them and record it.
for pid in $(pgrep -f "$S/.doorbell/kit/waiter.mjs" || true); do
  echo "killing leftover waiter $pid: $(ps -o args= -p "$pid" | cut -c1-200)" >> "$OUT/05-driver.txt"
  kill "$pid" 2>/dev/null || true
done
sleep 1
date -Is >> "$OUT/05-driver.txt"
cp "$PLOG" "$OUT/06-probe-log.jsonl"
"$NODE" "$TOOLS/doorbell/summary.mjs" --dir "$D" > "$OUT/07-summary.txt" 2>&1 || true
echo "run $V done"
