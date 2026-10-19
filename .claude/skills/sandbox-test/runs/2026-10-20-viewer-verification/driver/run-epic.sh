#!/usr/bin/env bash
# Usage: run-epic.sh. Part 3: this epic's artifacts in the app. Copies .epic-loop/epics/visual-review
# without .runtime and reviews into a scratch project, migrates it to T ids and sets the second
# language with the source skill, serves it, and runs epic-links.mjs (links, anchors, ids) and
# epic-check.mjs (translations, screenshots). Never touches the live epic.
main() {
set -euo pipefail
W=/projects/my-projects/epic-loop-workspace
REPO=$W/epic-loop-visual
DRV=$REPO/.claude/skills/sandbox-test/runs/2026-10-20-viewer-verification/driver
R=$W/sandbox-logs/2026-10-20-viewer-verification
S=$W/sandbox-viewer-epic
OUT=$R/artifacts/epic
CLI=$REPO/packages/cli/src/cli.mjs
SCRIPTS=$REPO/plugins/epic-loop/skills/epic-loop/scripts
NODE="$(node -p process.execPath)"
mkdir -p "$OUT"
rm -rf "${S:?}"
mkdir -p "$S/.epic-loop/.runtime" "$S/.epic-loop/epics"
rsync -a --exclude .runtime --exclude reviews "$REPO/.epic-loop/epics/visual-review/" "$S/.epic-loop/epics/visual-review/"
echo '{"platform":"claude-code"}' > "$S/.epic-loop/.runtime/platform.json"
"$NODE" --input-type=module -e "import { ensureTrackerTaskIds } from '$SCRIPTS/lib/task-ids.mjs'; console.log('migrated', ensureTrackerTaskIds(process.argv[1]));" "$S/.epic-loop/epics/visual-review" > "$OUT/00-migrate.txt"
"$NODE" "$SCRIPTS/set-second-language.mjs" --root "$S" --slug visual-review --lang ru >> "$OUT/00-migrate.txt"
env -u EPIC_LOOP_CLAUDE_BIN -u EPIC_LOOP_CODEX_BIN EPIC_LOOP_NO_UPDATE_CHECK=1 "$NODE" "$CLI" serve --root "$S" --detach --json > "$OUT/02-serve.json"
URL="$("$NODE" -p "JSON.parse(require('fs').readFileSync('$OUT/02-serve.json','utf8')).url")"
"$NODE" "$DRV/epic-links.mjs" "$URL" visual-review "$S/.epic-loop/epics/visual-review" "$REPO/packages/cli/src" > "$OUT/03-links.json" 2>&1 || true
"$NODE" "$DRV/epic-check.mjs" --sandbox "$S" --out "$OUT" --url "$URL" > "$OUT/04-epic-check.log" 2>&1 || true
EPIC_LOOP_NO_UPDATE_CHECK=1 "$NODE" "$CLI" serve --root "$S" --stop --json > "$OUT/05-stop.json" 2>&1 || true
echo "cell epic done"
}
main "$@"
