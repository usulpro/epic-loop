#!/usr/bin/env bash
# Usage: run-e2e.sh <E1|E2|E3>. Doorbell end to end inside a running epic-loop implementation loop on Claude Code.
# E1: the engineer's background waiter; E2: the UserPromptSubmit fallback only; E3: an asyncRewake (Stop) waiter
# after the loop went idle through a class B stop. One sandbox per scenario, epic-loop from this worktree's source.
main() {
set -euo pipefail
E="$1"
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop-visual
TOOLS=$REPO/.claude/skills/sandbox-test/tools
KIT_SRC=$TOOLS/doorbell
DRV=$REPO/.claude/skills/sandbox-test/runs/2026-10-20-doorbell-claude-e2e/driver
R=$W/sandbox-logs/2026-10-20-doorbell-claude-e2e
S=$W/sandbox-dbe-$E
OUT=$R/artifacts/$E
NODE="$(node -p process.execPath)"
mkdir -p "$OUT"
rm -rf "${S:?}"
git clone -q "$R/fixture-$E" "$S"
cd "$S"
git remote remove origin
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR -u CLAUDE_CODE_STOP_HOOK_BLOCK_CAP \
  "$NODE" "$REPO/packages/cli/src/cli.mjs" install --platform claude-code > "$OUT/00-epic-loop-install.txt" 2>&1
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0 \
  "$NODE" .claude/skills/epic-loop/scripts/epic-loop.mjs doctor --platform claude-code --json > "$OUT/00-doctor.json" 2>&1 || true
case "$E" in E1) VARIANT=background ;; E2) VARIANT=fallback-only ;; E3) VARIANT=rewake-event ;; esac
"$NODE" "$KIT_SRC/install.mjs" --sandbox "$S" --host claude-code --variant "$VARIANT" > "$OUT/01-install.json"
cp "$S/.claude/settings.json" "$OUT/01-settings.json"
D="$S/.doorbell"
export PLOG="$D/probe-log.jsonl" ELOG="$S/.epic-loop/epics/mini/.runtime/progress-log.jsonl" NODE KIT="$D/kit" DIR="$D"
touch "$PLOG"
"$NODE" "$KIT_SRC/server.mjs" --dir "$D" --ring file > "$OUT/02-server.txt" 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
RULE4=""
[ "$E" = E3 ] && RULE4=" 4. If a message or system reminder containing 'Doorbell:' arrives at any time, run once: node .doorbell/kit/pickup.mjs --via asyncRewake --saw '<the doorbell text, one line>' and then continue as the epic-loop skill's rules say."
export PROMPT="You are working in a disposable sandbox project. Use the epic-loop skill (project-local copy in .claude/skills/epic-loop). Everything below is the user's explicit answer and approval: do not ask questions. 1. Follow the skill's First Move (doctor through the skill wrapper, platform claude-code). Hooks are installed and approved. 2. Continue the existing epic with the slug mini. It is shaped and approved. 3. The user explicitly confirms: start implementation now in this session. Bind this session and work in the implementation loop until it stops. Commit as the loop prescribes.${RULE4} 5. This sandbox denies compound shell commands: run exactly one simple command per Bash call (no ';', '&&', '|', redirections, or variable assignments); single commands such as node, git, npm test, cat and ls are allowed."
printf '%s\n' "$PROMPT" > "$OUT/03-prompt.txt"
"$NODE" "$DRV/make-steps.mjs" "$E" > "$OUT/03-steps.json"
date -Is >> "$OUT/05-driver.txt"
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0 CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1 \
  timeout 45m python3 "$TOOLS/ptydrive.py" "$OUT/03-steps.json" "$OUT/04-raw.log" -- \
  claude --model sonnet --setting-sources project --permission-mode dontAsk \
  --allowedTools Read Edit Write Glob Grep "Bash(node:*)" "Bash(npx:*)" "Bash(git:*)" "Bash(npm test:*)" "Bash(ls:*)" "Bash(cat:*)" \
  >> "$OUT/05-driver.txt" 2>&1 || echo "driver exit $?" >> "$OUT/05-driver.txt"
kill $SRV 2>/dev/null || true
for pid in $(pgrep -f "$S/.doorbell/kit/waiter.mjs" || true); do
  echo "killing leftover waiter $pid" >> "$OUT/05-driver.txt"
  kill "$pid" 2>/dev/null || true
done
date -Is >> "$OUT/05-driver.txt"
cp "$PLOG" "$OUT/06-probe-log.jsonl"
[ -f "$ELOG" ] && cp "$ELOG" "$OUT/06-epic-progress-log.jsonl"
"$NODE" "$KIT_SRC/summary.mjs" --dir "$D" > "$OUT/07-summary.txt" 2>&1 || true
echo "scenario $E done"
}
main "$@"
