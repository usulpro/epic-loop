#!/usr/bin/env bash
# Usage: run.sh claude. The epic viewer on a live Claude Code loop: an interactive session (ptydrive)
# runs the loop unattended while viewer-check.mjs watches the served app from outside (D-19, D-20).
# epic-loop is installed from this worktree's source with EPIC_LOOP_CLI; the server is started here.
main() {
set -euo pipefail
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop-visual
TOOLS=$REPO/.claude/skills/sandbox-test/tools
DRV=$REPO/.claude/skills/sandbox-test/runs/2026-10-20-viewer-verification/driver
R=$W/sandbox-logs/2026-10-20-viewer-verification
S=$W/sandbox-viewer-claude
OUT=$R/artifacts/claude
CLI=$REPO/packages/cli/src/cli.mjs
NODE="$(node -p process.execPath)"
mkdir -p "$OUT"
rm -rf "${S:?}"
git clone -q "$R/fixture" "$S"
cd "$S"
git remote remove origin
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR -u CLAUDE_CODE_STOP_HOOK_BLOCK_CAP \
  "$NODE" "$CLI" install --platform claude-code --root "$S" > "$OUT/00-install.txt" 2>&1
env -u EPIC_LOOP_SKILL_DIR EPIC_LOOP_CLI="$CLI" EPIC_LOOP_NO_UPDATE_CHECK=1 CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0 \
  "$NODE" .claude/skills/epic-loop/scripts/epic-loop.mjs doctor --platform claude-code --json > "$OUT/00-doctor.json" 2>&1 || true
cp "$S/.claude/settings.json" "$OUT/01-settings.json"
env -u EPIC_LOOP_CLAUDE_BIN -u EPIC_LOOP_CODEX_BIN EPIC_LOOP_NO_UPDATE_CHECK=1 "$NODE" "$CLI" serve --root "$S" --detach --json > "$OUT/02-serve.json"
URL="$("$NODE" -p "JSON.parse(require('fs').readFileSync('$OUT/02-serve.json','utf8')).url")"
export OUT PROMPT="You are working in a disposable sandbox project. Use the epic-loop skill (project-local copy in .claude/skills/epic-loop). Everything below is the user's explicit answer and approval: do not ask questions. 1. Follow the skill's First Move (doctor through the skill wrapper, platform claude-code). Hooks are installed and approved. 2. Continue the existing epic with the slug mini. It is shaped and approved. 3. The user explicitly confirms: start implementation now in this session. Bind this session and work in the implementation loop until it stops. Commit as the loop prescribes. 4. The epic app (epic-loop serve) is already running; you never need to open it. The human's language is Russian and the epic's second language is already set to ru: keep it. H1 blocks no Phase 1 task; leave it open. 5. This session runs in don't-ask mode: a Bash call that is denied (for example one with pipes or several commands) only means that command; split it into simple single commands and retry. Never conclude that Bash is unavailable and never end a role turn without its handoff script because of one denial."
printf '%s\n' "$PROMPT" > "$OUT/03-prompt.txt"
"$NODE" "$DRV/make-steps.mjs" > "$OUT/03-steps.json"
"$NODE" "$DRV/viewer-check.mjs" --sandbox "$S" --out "$OUT" --url "$URL" --max-minutes 40 > "$OUT/07-viewer-check.log" 2>&1 &
CHECK=$!
"$NODE" "$DRV/sse-log.mjs" --url "$URL" --sandbox "$S" --out "$OUT/08-sse-events.jsonl" --minutes 12 > /dev/null 2>&1 &
SSELOG=$!
date -Is >> "$OUT/05-driver.txt"
env -u EPIC_LOOP_SKILL_DIR EPIC_LOOP_CLI="$CLI" EPIC_LOOP_NO_UPDATE_CHECK=1 CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0 CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1 \
  timeout 60m python3 "$TOOLS/ptydrive.py" "$OUT/03-steps.json" "$OUT/04-raw.log" -- \
  claude --model sonnet --setting-sources project --permission-mode dontAsk \
  --allowedTools Read Edit Write Glob Grep Agent Bash \
  >> "$OUT/05-driver.txt" 2>&1 || echo "driver exit $?" >> "$OUT/05-driver.txt"
date -Is >> "$OUT/05-driver.txt"
wait "$CHECK" || echo "viewer-check exit $?" >> "$OUT/05-driver.txt"
kill "$SSELOG" 2> /dev/null || true
EPIC_LOOP_NO_UPDATE_CHECK=1 "$NODE" "$CLI" serve --root "$S" --stop --json >> "$OUT/05-driver.txt" 2>&1 || true
"$NODE" "$DRV/reap.mjs" "$S" >> "$OUT/05-driver.txt" 2>&1 || true
cp "$S/.epic-loop/epics/mini/.runtime/progress-log.jsonl" "$OUT/06-progress-log.jsonl" || true
echo "cell claude done"
}
main "$@"
