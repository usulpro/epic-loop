#!/usr/bin/env bash
# Usage: run-session.sh <run1|run2>. Codex variant of run 6's driver. run1 clones the fixture into a
# fresh sandbox, installs the branch's skill for Codex through the local CLI, enables project hooks,
# checks doctor and starts the foreign port holder; both runs then drive one headless `codex exec`
# session with the matching prompt, hooks and project pre-trusted inline (D-7).
set -euo pipefail
X="$1"
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop
R=$W/sandbox-logs/2026-10-18-stop-gate-codex
D=$REPO/.claude/skills/sandbox-test/runs/2026-10-18-stop-gate-codex/driver
S=$W/sandbox-stop-gate-codex
OUT=$R/artifacts/$X
TOOLS=$REPO/.claude/skills/sandbox-test/tools
NODE="$(node -p process.execPath)"
mkdir -p "$OUT"
if [ "$X" = run1 ]; then
  rm -rf "$S"
  # Same fixture commit as runs 5 and 6.
  git clone -q "$W/sandbox-logs/2026-10-18-stop-gate-claude/fixture" "$S"
  cd "$S"
  git config user.email sandbox@example.invalid
  git config user.name Sandbox
  git remote remove origin
  env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR \
    "$NODE" "$REPO/packages/cli/src/cli.mjs" install --platform codex > "$OUT/01-install.txt" 2>&1
  diff -rq -x .runtime .codex/skills/epic-loop "$REPO/plugins/epic-loop/skills/epic-loop" >> "$OUT/01-install.txt" 2>&1 && echo "skill copy identical" >> "$OUT/01-install.txt"
  printf '[features]\nhooks = true\n' >> .codex/config.toml
  env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR \
    "$NODE" .codex/skills/epic-loop/scripts/epic-loop.mjs doctor --platform codex --json > "$OUT/02-doctor.json" 2>&1 || true
  # The foreign process that holds the port the serve task needs (stop class D).
  nohup "$NODE" -e "require('net').createServer((s) => s.end('foreign\n')).listen(4317)" > /dev/null 2>&1 &
  echo $! > "$R/port-holder.pid"
  sleep 1
fi
cd "$S"
cp "$D/prompt-$X.txt" "$OUT/03-prompt.txt"
TRUST="$("$NODE" "$TOOLS/codex-trust-args.mjs" "$S/.codex/hooks.json" "$S" | tr '\0' '\n')"
TRUST_HOOKS="$(printf '%s\n' "$TRUST" | sed -n 1p)"
TRUST_PROJECT="$(printf '%s\n' "$TRUST" | sed -n 2p)"
printf '%s\n%s\n' "$TRUST_HOOKS" "$TRUST_PROJECT" > "$OUT/04-trust-args.txt"
"$NODE" "$TOOLS/state-history.mjs" "$S/.epic-loop/epics/report-export/.runtime/runtime-state.json" "$OUT/05-state-history" 200 &
HIST=$!
trap 'kill $HIST 2>/dev/null || true' EXIT
env -u EPIC_LOOP_CLI -u EPIC_LOOP_SKILL_DIR timeout 50m \
  codex exec -C "$S" -m gpt-5.6-sol -s danger-full-access \
  -c check_for_update_on_startup=false -c approval_policy=never \
  -c "$TRUST_HOOKS" -c "$TRUST_PROJECT" \
  --json "$(cat "$D/prompt-$X.txt")" < /dev/null > "$OUT/06-session.jsonl" 2> "$OUT/06-session.stderr" || echo "session exit $?" >> "$OUT/06-session.stderr"
date -Is >> "$OUT/06-session.stderr"
echo "session $X done"
