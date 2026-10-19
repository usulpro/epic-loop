#!/usr/bin/env bash
# Usage: run-codex.sh. The epic viewer against a minimal headless Codex loop (D-13, D-14): workspace-write
# (never danger-full-access, D-7/D-17), --ignore-user-config, low effort; codex-check.mjs watches the app
# from outside and stops the session after 3 turn-stop events or 10 minutes. A failing commit is expected.
main() {
set -euo pipefail
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop-visual
TOOLS=$REPO/.claude/skills/sandbox-test/tools
DRV=$REPO/.claude/skills/sandbox-test/runs/2026-10-20-viewer-verification/driver
R=$W/sandbox-logs/2026-10-20-viewer-verification
S=$W/sandbox-viewer-codex
OUT=$R/artifacts/codex
CLI=$REPO/packages/cli/src/cli.mjs
NODE="$(node -p process.execPath)"
mkdir -p "$OUT"
rm -rf "${S:?}"
git clone -q "$R/fixture" "$S"
cd "$S"
git remote remove origin
env -u EPIC_LOOP_SKILL_DIR "$NODE" "$CLI" install --platform codex --root "$S" > "$OUT/00-install.txt" 2>&1
printf '[features]\nhooks = true\n' >> .codex/config.toml
env -u EPIC_LOOP_SKILL_DIR EPIC_LOOP_CLI="$CLI" EPIC_LOOP_NO_UPDATE_CHECK=1 \
  "$NODE" .codex/skills/epic-loop/scripts/epic-loop.mjs doctor --platform codex --json > "$OUT/00-doctor.json" 2>&1 || true
env -u EPIC_LOOP_CLAUDE_BIN -u EPIC_LOOP_CODEX_BIN EPIC_LOOP_NO_UPDATE_CHECK=1 "$NODE" "$CLI" serve --root "$S" --detach --json > "$OUT/02-serve.json"
URL="$("$NODE" -p "JSON.parse(require('fs').readFileSync('$OUT/02-serve.json','utf8')).url")"
TRUST="$("$NODE" "$TOOLS/codex-trust-args.mjs" "$S/.codex/hooks.json" "$S" | tr '\0' '\n')"
PROMPT="You are working in a disposable sandbox project. Use the epic-loop skill (project-local copy in .codex/skills/epic-loop). Everything below is the user's explicit answer and approval: do not ask questions. 1. Follow the skill's First Move (doctor through the skill wrapper, platform codex). Hooks are installed and approved. 2. Continue the existing epic with the slug mini. It is shaped and approved. 3. The user explicitly confirms: start implementation now in this session. Bind this session and work in the implementation loop. 4. The epic app (epic-loop serve) is already running; you never need to open it. The epic's second language is already set to ru: keep it. H1 blocks no Phase 1 task; leave it open."
printf '%s\n' "$PROMPT" > "$OUT/03-prompt.txt"
date -Is > "$OUT/05-driver.txt"
env -u EPIC_LOOP_SKILL_DIR EPIC_LOOP_CLI="$CLI" EPIC_LOOP_NO_UPDATE_CHECK=1 timeout 15m \
  codex exec --ignore-user-config -C "$S" -m gpt-5.6-sol -c model_reasoning_effort=low -c check_for_update_on_startup=false \
  -s workspace-write -c approval_policy=never \
  -c "shell_environment_policy.set={EPIC_LOOP_CLI=\"$CLI\", EPIC_LOOP_NO_UPDATE_CHECK=\"1\"}" \
  -c "$(printf '%s\n' "$TRUST" | sed -n 1p)" -c "$(printf '%s\n' "$TRUST" | sed -n 2p)" \
  --json "$PROMPT" < /dev/null > "$OUT/04-session.jsonl" 2> "$OUT/04-session.stderr" &
SESSION=$!
"$NODE" "$DRV/codex-check.mjs" --sandbox "$S" --out "$OUT" --url "$URL" --kill "$SESSION" --turns 3 --max-minutes 10 > "$OUT/07-codex-check.log" 2>&1 || true
wait "$SESSION" || echo "session exit $?" >> "$OUT/05-driver.txt"
date -Is >> "$OUT/05-driver.txt"
EPIC_LOOP_NO_UPDATE_CHECK=1 "$NODE" "$CLI" serve --root "$S" --stop --json >> "$OUT/05-driver.txt" 2>&1 || true
"$NODE" "$DRV/reap.mjs" "$S" >> "$OUT/05-driver.txt" 2>&1 || true
cp "$S/.epic-loop/epics/mini/.runtime/progress-log.jsonl" "$OUT/06-progress-log.jsonl" || true
cp "$S/.epic-loop/epics/mini/.runtime/runtime-state.json" "$OUT/06-runtime-state.json" || true
echo "cell codex done"
}
main "$@"
