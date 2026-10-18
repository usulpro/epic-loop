#!/usr/bin/env bash
# Usage: run-session.sh <run1|run2>. run1 clones the fixture into a fresh sandbox, installs the
# branch's skill through the local CLI, checks doctor and starts the foreign port holder; both
# runs then drive one headless Claude Code session with the matching prompt.
set -euo pipefail
X="$1"
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop
R=$W/sandbox-logs/2026-10-18-stop-gate-claude
D=$REPO/.claude/skills/sandbox-test/runs/2026-10-18-stop-gate-claude/driver
S=$W/sandbox-stop-gate-claude
OUT=$R/artifacts/$X
TOOLS=$REPO/.claude/skills/sandbox-test/tools
NODE="$(node -p process.execPath)"
mkdir -p "$OUT"
if [ "$X" = run1 ]; then
  rm -rf "$S"
  git clone -q "$R/fixture" "$S"
  cd "$S"
  git config user.email sandbox@example.invalid
  git config user.name Sandbox
  git remote remove origin
  env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR -u CLAUDE_CODE_STOP_HOOK_BLOCK_CAP \
    "$NODE" "$REPO/packages/cli/src/cli.mjs" install --platform claude-code > "$OUT/01-install.txt" 2>&1
  diff -rq -x .runtime .claude/skills/epic-loop "$REPO/plugins/epic-loop/skills/epic-loop" >> "$OUT/01-install.txt" 2>&1 && echo "skill copy identical" >> "$OUT/01-install.txt"
  env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0 \
    "$NODE" .claude/skills/epic-loop/scripts/epic-loop.mjs doctor --platform claude-code --json > "$OUT/02-doctor.json" 2>&1 || true
  # The foreign process that holds the port the serve task needs (stop class D).
  nohup "$NODE" -e "require('net').createServer((s) => s.end('foreign\n')).listen(4317)" > /dev/null 2>&1 &
  echo $! > "$R/port-holder.pid"
  sleep 1
fi
cd "$S"
cp "$D/prompt-$X.txt" "$OUT/03-prompt.txt"
"$NODE" "$TOOLS/state-history.mjs" "$S/.epic-loop/epics/report-export/.runtime/runtime-state.json" "$OUT/05-state-history" 200 &
HIST=$!
trap 'kill $HIST 2>/dev/null || true' EXIT
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0 timeout 50m \
  claude -p "$(cat "$D/prompt-$X.txt")" --output-format stream-json --verbose \
  --setting-sources project --permission-mode acceptEdits \
  --allowedTools Read Edit Write Glob Grep Monitor "Bash(node:*)" "Bash(npx:*)" "Bash(git:*)" "Bash(npm test:*)" "Bash(ls:*)" "Bash(cat:*)" "Bash(head:*)" "Bash(wc:*)" "Bash(curl:*)" \
  --max-budget-usd 15 > "$OUT/06-session.jsonl" 2> "$OUT/06-session.stderr" || echo "session exit $?" >> "$OUT/06-session.stderr"
date -Is >> "$OUT/06-session.stderr"
echo "session $X done"
