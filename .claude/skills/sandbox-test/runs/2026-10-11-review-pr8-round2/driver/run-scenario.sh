#!/usr/bin/env bash
# Usage: run-scenario.sh <A|B|C>. Clones the fixture into a fresh sandbox, installs the branch's
# skill through the local CLI, checks doctor, then drives one interactive Claude Code session.
set -euo pipefail
X="$1"
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop
R=$W/sandbox-logs/2026-10-11-review-pr8-round2
D=$R/driver
S=$W/sandbox-review-pr8-r2-$X
OUT=$R/artifacts/$X
TOOLS=$REPO/.claude/skills/sandbox-test/tools
mkdir -p "$OUT"
rm -rf "$S"
git clone -q "$R/fixture" "$S"
cd "$S"
git config user.email sandbox@example.invalid
git config user.name Sandbox
git remote remove origin
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR -u CLAUDE_CODE_STOP_HOOK_BLOCK_CAP \
  node "$REPO/packages/cli/src/cli.mjs" install --platform claude-code > "$OUT/01-install.txt" 2>&1
diff -rq -x .runtime .claude/skills/epic-loop "$REPO/plugins/epic-loop/skills/epic-loop" >> "$OUT/01-install.txt" 2>&1 && echo "skill copy identical" >> "$OUT/01-install.txt"
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0 \
  node .claude/skills/epic-loop/scripts/epic-loop.mjs doctor --platform claude-code --json > "$OUT/02-doctor.json" 2>&1 || true
PROTOCOL="$(cat "$D/protocol-$X.txt")"
PROMPT="$(cat "$D/base-prompt.txt")"
PROMPT="${PROMPT/\{\{PROTOCOL\}\}/$PROTOCOL}"
printf '%s\n' "$PROMPT" > "$OUT/03-prompt.txt"
PROMPT="$PROMPT" PLOG="$S/.epic-loop/epics/stats-helpers/.runtime/progress-log.jsonl" \
  node "$D/make-steps.mjs" "$X" > "$OUT/04-steps.json"
"$(node -p process.execPath)" "$TOOLS/state-history.mjs" "$S/.epic-loop/epics/stats-helpers/.runtime/runtime-state.json" "$OUT/05-state-history" 200 &
HIST=$!
trap 'kill $HIST 2>/dev/null || true' EXIT
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0 CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1 \
  python3 "$TOOLS/ptydrive.py" "$OUT/04-steps.json" "$OUT/06-interactive-raw.log" -- \
  claude --setting-sources project --permission-mode dontAsk \
  --allowedTools Read Edit Write Glob Grep Monitor "Bash(node:*)" "Bash(npx:*)" "Bash(git:*)" "Bash(npm:*)" "Bash(ls:*)" "Bash(cat:*)" "Bash(head:*)" "Bash(wc:*)" \
  > "$OUT/07-driver.txt" 2>&1 || echo "driver exit $?" >> "$OUT/07-driver.txt"
kill $HIST 2>/dev/null || true
date -Is >> "$OUT/07-driver.txt"
echo "scenario $X done"
