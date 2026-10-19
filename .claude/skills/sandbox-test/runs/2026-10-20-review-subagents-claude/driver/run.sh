#!/usr/bin/env bash
# Claude Code sandbox: a headless manager session delegates a review page to the page builder subagent
# and its Russian translation to the translator subagent (haiku). Local CLI via EPIC_LOOP_CLI.
main() {
set -euo pipefail
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop-visual
DRV=$REPO/.claude/skills/sandbox-test/runs/2026-10-20-review-subagents-claude/driver
R=$W/sandbox-logs/2026-10-20-review-subagents-claude
S=$W/sandbox-subagents-claude
OUT=$R/artifacts
NODE="$(node -p process.execPath)"
mkdir -p "$OUT"
rm -rf "${S:?}"
mkdir -p "$S/evidence" "$S/.epic-loop/epics/demo"
cd "$S"
git init -q -b main
git config user.email sandbox@example.invalid
git config user.name Sandbox
printf '# State Of Epic\n\nEpic: Demo landing page\n' > .epic-loop/epics/demo/state-of-epic.md
cat > evidence/header-compact.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="375" height="64" viewBox="0 0 375 64"><rect width="375" height="64" fill="#f5f4ef"/><rect x="12" y="20" width="72" height="24" fill="#1d6b47"/><text x="200" y="38" font-family="sans-serif" font-size="13" fill="#1c1b18">Docs  Pricing  Blog</text></svg>
SVG
cat > evidence/header-stacked.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="375" height="112" viewBox="0 0 375 112"><rect width="375" height="112" fill="#f5f4ef"/><rect x="151" y="16" width="72" height="24" fill="#1d6b47"/><text x="96" y="84" font-family="sans-serif" font-size="13" fill="#1c1b18">Docs  Pricing  Blog  Changelog</text></svg>
SVG
git add -A && git commit -qm "fixture: demo epic with header evidence"
env -u EPIC_LOOP_SKILL_DIR -u CLAUDE_CODE_STOP_HOOK_BLOCK_CAP "$NODE" "$REPO/packages/cli/src/cli.mjs" install --platform claude-code --root "$S" > "$OUT/01-install.txt" 2>&1
cp "$DRV/prompt.txt" "$OUT/02-prompt.txt"
date -Is > "$OUT/03-time.txt"
env -u EPIC_LOOP_SKILL_DIR EPIC_LOOP_CLI="$REPO/packages/cli/src/cli.mjs" EPIC_LOOP_NO_UPDATE_CHECK=1 CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1 timeout 25m \
  claude -p "$(cat "$DRV/prompt.txt")" --model sonnet --setting-sources project --output-format stream-json --verbose \
  --permission-mode acceptEdits --max-budget-usd 6 \
  --allowedTools Read Edit Write Glob Grep Agent Task "Bash(node:*)" "Bash(cp:*)" "Bash(mkdir:*)" "Bash(ls:*)" "Bash(cat:*)" \
  > "$OUT/04-session.jsonl" 2> "$OUT/04-session.stderr" || echo "session exit $?" >> "$OUT/04-session.stderr"
date -Is >> "$OUT/03-time.txt"
echo "session done"
}
main "$@"
