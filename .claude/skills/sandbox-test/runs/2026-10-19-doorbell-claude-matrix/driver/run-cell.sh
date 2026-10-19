#!/usr/bin/env bash
# Usage: run-cell.sh <cell>   e.g. 2A, 1B, 3D, 1E0, 1F, 1C, 1S
# One fresh sandbox per cell (D-11): row = mechanism (1 rewake-event, 2 rewake-session, 3 background,
# 4 fallback-only), state = A idle, B mid-turn, C epic-loop loop, D after Esc, E 15 min idle,
# F closed + resume, S stderr size. One interactive Claude Code session driven through ptydrive; the
# answers are submitted by a `run` step at the right moment.
set -euo pipefail
CELL="$1"
ROW="${CELL:0:1}"
STATE="${CELL:1:1}"
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop-visual
TOOLS=$REPO/.claude/skills/sandbox-test/tools
KIT_SRC=$TOOLS/doorbell
DRV=$REPO/.claude/skills/sandbox-test/runs/2026-10-19-doorbell-claude-matrix/driver
R=$W/sandbox-logs/2026-10-19-doorbell-claude-matrix
S=$W/sandbox-dbm-$CELL
OUT=$R/artifacts/$CELL
NODE="$(node -p process.execPath)"
VARIANT=$(case "$ROW" in 1) echo rewake-event ;; 2) echo rewake-session ;; 3) echo background ;; 4) echo fallback-only ;; esac)
EXTRA=()
[ "$CELL" = 1E0 ] && EXTRA+=(--rewake-timeout default)
[ "$STATE" = S ] && EXTRA+=(--rewake-pad 20000)
[ "$STATE" = F ] && EXTRA+=(--fallback)
mkdir -p "$OUT"
rm -rf "${S:?}"
if [ "$STATE" = C ]; then
  git clone -q "$R/fixture" "$S"
  cd "$S"
  git remote remove origin
  env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR -u CLAUDE_CODE_STOP_HOOK_BLOCK_CAP \
    "$NODE" "$REPO/packages/cli/src/cli.mjs" install --platform claude-code > "$OUT/00-epic-loop-install.txt" 2>&1
  env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0 \
    "$NODE" .claude/skills/epic-loop/scripts/epic-loop.mjs doctor --platform claude-code --json > "$OUT/00-doctor.json" 2>&1 || true
else
  mkdir -p "$S"
  cd "$S"
  git init -q -b main
  printf '# Doorbell matrix sandbox\n' > README.md
  git add README.md
  git -c user.email=sandbox@example.invalid -c user.name=Sandbox commit -qm init
fi
git config user.email sandbox@example.invalid
git config user.name Sandbox
"$NODE" "$KIT_SRC/install.mjs" --sandbox "$S" --host claude-code --variant "$VARIANT" ${EXTRA[@]+"${EXTRA[@]}"} > "$OUT/01-install.json"
cp "$S/.claude/settings.json" "$OUT/01-settings.json"
D="$S/.doorbell"
export PLOG="$D/probe-log.jsonl" ELOG="$S/.epic-loop/epics/mini/.runtime/progress-log.jsonl" ROW NODE KIT="$D/kit" DIR="$D"
touch "$PLOG"
"$NODE" "$KIT_SRC/server.mjs" --dir "$D" --ring file > "$OUT/02-server.txt" 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
if [ "$STATE" = C ]; then
  PRE=""
  [ "$ROW" = 3 ] && PRE="0. Before anything else, start the doorbell waiter as a background task (Bash with run_in_background): node .doorbell/kit/waiter.mjs --mode background. Do not wait for it."
  export PROMPT="You are working in a disposable sandbox project. Use the epic-loop skill (project-local copy in .claude/skills/epic-loop). Everything below is the user's explicit answer and approval: do not ask questions. ${PRE} 1. Follow the skill's First Move (doctor through the skill wrapper, platform claude-code). Hooks are installed and approved. 2. Continue the existing epic with the slug mini. It is shaped and approved. 3. The user explicitly confirms: start implementation now in this session. Bind this session and work in the implementation loop until it stops. Commit as the loop prescribes. 4. Standing rule for this whole session, in every role: when a doorbell arrives (a message or system reminder whose text starts with 'Doorbell:', or the completion of the doorbell background task, whose output file holds that text), run once: node .doorbell/kit/pickup.mjs --via <asyncRewake|background-task|user-prompt> --saw '<the doorbell text, one line>' and then continue exactly the work of your current role. Never stop or change role because of the doorbell. 5. This sandbox denies compound shell commands: run exactly one simple command per Bash call (no ';', '&&', '|', redirections, or variable assignments); single commands such as node, git, npm test and ls are allowed."
else
  export PROMPT="Read .doorbell/probe.md and follow it exactly."
fi
printf '%s\n' "$PROMPT" > "$OUT/03-prompt.txt"
ALLOW=(Read "Bash(node:*)")
[ "$STATE" = C ] && ALLOW=(Read Edit Write Glob Grep "Bash(node:*)" "Bash(npx:*)" "Bash(git:*)" "Bash(npm test:*)" "Bash(ls:*)")
run_claude() { # <steps> <raw log> [claude args...]
  local steps="$1" raw="$2"
  shift 2
  env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0 CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1 \
    timeout 45m python3 "$TOOLS/ptydrive.py" "$steps" "$raw" -- \
    claude --model sonnet --setting-sources project --permission-mode dontAsk --allowedTools "${ALLOW[@]}" "$@" \
    >> "$OUT/05-driver.txt" 2>&1 || echo "driver exit $?" >> "$OUT/05-driver.txt"
}
date -Is >> "$OUT/05-driver.txt"
if [ "$STATE" = F ]; then
  "$NODE" "$DRV/make-steps.mjs" F 1 > "$OUT/03-steps-1.json"
  run_claude "$OUT/03-steps-1.json" "$OUT/04-raw-1.log"
  sleep 3
  echo "session closed; submitting while closed at $(date -Is)" >> "$OUT/05-driver.txt"
  "$NODE" "$KIT_SRC/submit.mjs" --dir "$D" --answer "answer for cell ${CELL} (submitted while closed)" >> "$OUT/05-driver.txt" 2>&1
  SID=$(grep -o '"hookEvent":"SessionStart","sessionId":"[^"]*"' "$PLOG" | head -1 | sed 's/.*"sessionId":"//;s/"$//')
  echo "resuming $SID" >> "$OUT/05-driver.txt"
  sleep 5
  "$NODE" "$DRV/make-steps.mjs" F 2 > "$OUT/03-steps-2.json"
  run_claude "$OUT/03-steps-2.json" "$OUT/04-raw-2.log" --resume "$SID"
else
  "$NODE" "$DRV/make-steps.mjs" "$STATE" > "$OUT/03-steps.json"
  run_claude "$OUT/03-steps.json" "$OUT/04-raw.log"
fi
kill $SRV 2>/dev/null || true
for pid in $(pgrep -f "$S/.doorbell/kit/waiter.mjs" || true); do
  echo "killing leftover waiter $pid: $(ps -o args= -p "$pid" | cut -c1-160)" >> "$OUT/05-driver.txt"
  kill "$pid" 2>/dev/null || true
done
date -Is >> "$OUT/05-driver.txt"
cp "$PLOG" "$OUT/06-probe-log.jsonl"
[ -f "$ELOG" ] && cp "$ELOG" "$OUT/06-epic-progress-log.jsonl"
"$NODE" "$KIT_SRC/summary.mjs" --dir "$D" > "$OUT/07-summary.txt" 2>&1 || true
echo "cell $CELL done"
