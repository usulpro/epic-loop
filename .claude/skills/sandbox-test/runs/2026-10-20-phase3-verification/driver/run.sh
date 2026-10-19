#!/usr/bin/env bash
# Phase 3 verification: one manager session per platform builds three review pages through three page
# builder subagents and translates them through three translator subagents (cheap model). Local CLI via
# EPIC_LOOP_CLI. Usage: run.sh claude|codex. Claude allows all of Bash: the subagents do not see the
# prompt's one-command rule, and attempt 1 stalled on their compound commands under prefix rules.
# The server and the browser run afterwards in verify.mjs.
main() {
set -euo pipefail
P="$1"
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop-visual
TOOLS=$REPO/.claude/skills/sandbox-test/tools
DRV=$REPO/.claude/skills/sandbox-test/runs/2026-10-20-phase3-verification/driver
R=$W/sandbox-logs/2026-10-20-phase3-verification/$P
S=$W/sandbox-phase3-$P
OUT=$R/artifacts
NODE="$(node -p process.execPath)"
mkdir -p "$OUT"
rm -rf "${S:?}"
mkdir -p "$S/evidence" "$S/.epic-loop/epics/demo"
cd "$S"
git init -q -b main
git config user.email sandbox@example.invalid
git config user.name Sandbox
cp "$DRV"/fixture/epic/*.md .epic-loop/epics/demo/
cp "$DRV"/fixture/evidence/* evidence/
git add -A && git commit -qm "fixture: demo epic stopped on class B, with pricing and footer evidence"
cp "$DRV/prompt-$P.txt" "$OUT/02-prompt.txt"
if [ "$P" = claude ]; then
  env -u EPIC_LOOP_SKILL_DIR -u CLAUDE_CODE_STOP_HOOK_BLOCK_CAP "$NODE" "$REPO/packages/cli/src/cli.mjs" install --platform claude-code --root "$S" > "$OUT/01-install.txt" 2>&1
  date -Is > "$OUT/03-time.txt"
  env -u EPIC_LOOP_SKILL_DIR EPIC_LOOP_CLI="$REPO/packages/cli/src/cli.mjs" EPIC_LOOP_NO_UPDATE_CHECK=1 CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1 timeout 30m \
    claude -p "$(cat "$DRV/prompt-claude.txt")" --model sonnet --setting-sources project --output-format stream-json --verbose \
    --permission-mode acceptEdits --max-budget-usd 5 \
    --allowedTools Read Edit Write Glob Grep Agent Task Bash \
    > "$OUT/04-session.jsonl" 2> "$OUT/04-session.stderr" || echo "session exit $?" >> "$OUT/04-session.stderr"
else
  env -u EPIC_LOOP_SKILL_DIR "$NODE" "$REPO/packages/cli/src/cli.mjs" install --platform codex --root "$S" > "$OUT/01-install.txt" 2>&1
  printf '[features]\nhooks = true\n' >> .codex/config.toml
  TRUST="$("$NODE" "$TOOLS/codex-trust-args.mjs" "$S/.codex/hooks.json" "$S" | tr '\0' '\n')"
  date -Is > "$OUT/03-time.txt"
  env -u EPIC_LOOP_SKILL_DIR EPIC_LOOP_CLI="$REPO/packages/cli/src/cli.mjs" EPIC_LOOP_NO_UPDATE_CHECK=1 timeout 30m \
    codex exec --ignore-user-config -C "$S" -m gpt-5.6-sol -c model_reasoning_effort=low -c check_for_update_on_startup=false \
    -s workspace-write -c approval_policy=never \
    -c "shell_environment_policy.set={EPIC_LOOP_CLI=\"$REPO/packages/cli/src/cli.mjs\", EPIC_LOOP_NO_UPDATE_CHECK=\"1\"}" \
    -c "$(printf '%s\n' "$TRUST" | sed -n 1p)" -c "$(printf '%s\n' "$TRUST" | sed -n 2p)" \
    --json "$(cat "$DRV/prompt-codex.txt")" < /dev/null > "$OUT/04-session.jsonl" 2> "$OUT/04-session.stderr" || echo "session exit $?" >> "$OUT/04-session.stderr"
fi
date -Is >> "$OUT/03-time.txt"
echo "session done"
}
main "$@"
