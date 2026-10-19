#!/usr/bin/env bash
# Usage: run.sh <G|SON|SOFF>. Human gates end to end in an interactive Claude Code session that runs the
# epic-loop implementation loop unattended; the human side is human.mjs (CDP and HTTP) from ptydrive run steps.
# One sandbox per cell, cloned from the fixture repo; epic-loop installed from this worktree's source.
main() {
set -euo pipefail
C="$1"
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop-visual
TOOLS=$REPO/.claude/skills/sandbox-test/tools
DRV=$REPO/.claude/skills/sandbox-test/runs/2026-10-20-human-gates-claude/driver
R=$W/sandbox-logs/2026-10-20-human-gates-claude
S=$W/sandbox-hg-$C
OUT=$R/artifacts/$C
CLI=$REPO/packages/cli/src/cli.mjs
NODE="$(node -p process.execPath)"
case "$C" in G) FIX=G ;; SON|SOFF) FIX=S ;; *) echo "unknown cell" >&2; exit 2 ;; esac
mkdir -p "$OUT"
rm -rf "${S:?}"
git clone -q "$R/fixture-$FIX" "$S"
cd "$S"
git remote remove origin
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR -u CLAUDE_CODE_STOP_HOOK_BLOCK_CAP \
  "$NODE" "$CLI" install --platform claude-code --root "$S" > "$OUT/00-install.txt" 2>&1
env -u EPIC_LOOP_SKILL_DIR EPIC_LOOP_CLI="$CLI" EPIC_LOOP_NO_UPDATE_CHECK=1 CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0 \
  "$NODE" .claude/skills/epic-loop/scripts/epic-loop.mjs doctor --platform claude-code --json > "$OUT/00-doctor.json" 2>&1 || true
cp "$S/.claude/settings.json" "$OUT/01-settings.json"
EPIC_LOOP_NO_UPDATE_CHECK=1 "$NODE" "$CLI" serve --root "$S" --detach --json > "$OUT/02-serve.json"
export ELOG="$S/.epic-loop/epics/mini/.runtime/progress-log.jsonl" NODE HUMAN="$DRV/human.mjs" S OUT
mkdir -p "$(dirname "$ELOG")"
touch "$ELOG"
export PROMPT="You are working in a disposable sandbox project. Use the epic-loop skill (project-local copy in .claude/skills/epic-loop). Everything below is the user's explicit answer and approval: do not ask questions. 1. Follow the skill's First Move (doctor through the skill wrapper, platform claude-code). Hooks are installed and approved. 2. Continue the existing epic with the slug mini. It is shaped and approved; its tracker tasks carry fixture rules that every role follows. 3. The user explicitly confirms: start implementation now in this session. Bind this session and work in the implementation loop until it stops. Commit as the loop prescribes. 4. The review server is already running (epic-loop serve); the human answers pages there and writes English, so review pages need no second language. Build pages with the page builder subagent as the skill's Review Pages section says. 5. This session runs in don't-ask mode: a Bash call that is denied (for example one with pipes or several commands) only means that command; split it into simple single commands and retry. Never conclude that Bash is unavailable and never end a role turn without its handoff script because of one denial."
printf '%s\n' "$PROMPT" > "$OUT/03-prompt.txt"
"$NODE" "$DRV/make-steps.mjs" "$C" > "$OUT/03-steps.json"
date -Is >> "$OUT/05-driver.txt"
env -u EPIC_LOOP_SKILL_DIR EPIC_LOOP_CLI="$CLI" EPIC_LOOP_NO_UPDATE_CHECK=1 CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0 CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1 \
  timeout 90m python3 "$TOOLS/ptydrive.py" "$OUT/03-steps.json" "$OUT/04-raw.log" -- \
  claude --model sonnet --setting-sources project --permission-mode dontAsk \
  --allowedTools Read Edit Write Glob Grep Agent Bash \
  >> "$OUT/05-driver.txt" 2>&1 || echo "driver exit $?" >> "$OUT/05-driver.txt"
date -Is >> "$OUT/05-driver.txt"
EPIC_LOOP_NO_UPDATE_CHECK=1 "$NODE" "$CLI" serve --root "$S" --stop --json >> "$OUT/05-driver.txt" 2>&1 || true
"$NODE" "$DRV/reap.mjs" "$S" >> "$OUT/05-driver.txt" 2>&1 || true
cp "$ELOG" "$OUT/06-progress-log.jsonl"
echo "cell $C done"
}
main "$@"
