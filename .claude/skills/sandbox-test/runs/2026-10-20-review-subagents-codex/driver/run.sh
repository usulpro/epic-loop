#!/usr/bin/env bash
# Codex sandbox: a codex exec manager session delegates a review page to a page builder subagent and
# its Russian translation to a translator subagent on gpt-6-luna (spawn_agent / wait_agent).
# Minimal size (D-14): one session, low effort, user config ignored, default sandbox, 15-minute timeout.
main() {
set -euo pipefail
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop-visual
TOOLS=$REPO/.claude/skills/sandbox-test/tools
DRV=$REPO/.claude/skills/sandbox-test/runs/2026-10-20-review-subagents-codex/driver
R=$W/sandbox-logs/2026-10-20-review-subagents-codex
S=$W/sandbox-subagents-codex
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
cp "$REPO/.claude/skills/sandbox-test/runs/2026-10-20-review-subagents-codex/driver/header-compact.svg" evidence/
cp "$REPO/.claude/skills/sandbox-test/runs/2026-10-20-review-subagents-codex/driver/header-stacked.svg" evidence/
git add -A && git commit -qm "fixture: demo epic with header evidence"
env -u EPIC_LOOP_SKILL_DIR "$NODE" "$REPO/packages/cli/src/cli.mjs" install --platform codex --root "$S" > "$OUT/01-install.txt" 2>&1
printf '[features]\nhooks = true\n' >> .codex/config.toml
TRUST="$("$NODE" "$TOOLS/codex-trust-args.mjs" "$S/.codex/hooks.json" "$S" | tr '\0' '\n')"
cp "$DRV/prompt.txt" "$OUT/02-prompt.txt"
date -Is > "$OUT/03-time.txt"
env -u EPIC_LOOP_SKILL_DIR EPIC_LOOP_CLI="$REPO/packages/cli/src/cli.mjs" EPIC_LOOP_NO_UPDATE_CHECK=1 timeout 15m \
  codex exec --ignore-user-config -C "$S" -m gpt-5.6-sol -c model_reasoning_effort=low -c check_for_update_on_startup=false \
  -s workspace-write -c approval_policy=never \
  -c "shell_environment_policy.set={EPIC_LOOP_CLI=\"$REPO/packages/cli/src/cli.mjs\", EPIC_LOOP_NO_UPDATE_CHECK=\"1\"}" \
  -c "$(printf '%s\n' "$TRUST" | sed -n 1p)" -c "$(printf '%s\n' "$TRUST" | sed -n 2p)" \
  --json "$(cat "$DRV/prompt.txt")" < /dev/null > "$OUT/04-session.jsonl" 2> "$OUT/04-session.stderr" || echo "session exit $?" >> "$OUT/04-session.stderr"
date -Is >> "$OUT/03-time.txt"
echo "session done"
}
main "$@"
