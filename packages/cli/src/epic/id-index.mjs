// Temporary duplicate of the skill's id index for the epic app:
//   plugins/epic-loop/skills/epic-loop/scripts/lib/id-index.mjs (buildIdIndex, resolveId, canonicalId)
// The CLI cannot import the skill at runtime. Keep both in step; remove once the skill scripts
// migrate into this package.
import fs from "node:fs";
import path from "node:path";

// The id index of an epic (D27): where each task, decision, human-queue item, risk and open
// question is defined, for the viewer's reference expansion. Canonical ids have no hyphen
// (`D16`); the hyphenated form (`D-16`) is an alias. Definitions come from each kind's home file:
//   T  tracker.md and its archive layers (task lines with `T<n> · `)
//   D  decision-log.md (and archive layers): `- **D16 — Title** …`
//   Q  decision-log.md: `- **Q7 — Title.** …`
//   H  human-queue.md: `- **H3**` with its `Ask:` line
//   R  risk-register.md: a table row `| R5 | … |` or `- **R5 — Title**`
// Every other human-facing file (state-of-epic.md, docs/**) contributes only mentions; a mention
// of an id with no definition is reported as unknown. This module has no imports from the rest of
// the skill so the CLI app can keep a copy of it.

const KINDS = { D: "decision", H: "human-queue", Q: "open-question", R: "risk", T: "task" };
const TASK_LINE = /^- \[([ xX])\]\s+Kind:\s*([^|]+)\|\s*Status:\s*([^|]+)\|\s*T-?(\d+)\s+·\s+(.+)$/u;
const BOLD_DEFINITION = /^\s*-\s+\*\*([DQR])-?(\d+)\s+[—–-]\s+(.+?)\*\*(.*)$/u;
const H_ITEM = /^- \*\*H-?(\d+)\*\*\s*$/u;
const RISK_ROW = /^\|\s*R-?(\d+)\s*\|\s*([^|]+?)\s*\|/u;
// Exported for the epic app (the copy only adds this export).
export const MENTION = /(?<![A-Za-z0-9_-])([DHQRT])(-?)(\d+)(?![A-Za-z0-9_])/gu;

export function canonicalId(value) {
  const match = String(value ?? "")
    .trim()
    .match(/^([dhqrt])-?(\d+)$/iu);
  return match ? `${match[1].toUpperCase()}${Number(match[2])}` : null;
}

function listMarkdown(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === ".runtime" || entry.name === "reviews" ? [] : listMarkdown(full, base);
      return entry.name.endsWith(".md") ? [path.relative(base, full)] : [];
    })
    .sort();
}

function homeKinds(file) {
  if (file === "tracker.md" || /^tracker\..+\.previous-layer-\d+\.md$/u.test(file)) return ["T"];
  if (file === "decision-log.md" || /^decision-log\..+\.previous-layer-\d+\.md$/u.test(file)) return ["D", "Q"];
  if (file === "human-queue.md") return ["H"];
  if (file === "risk-register.md" || /^risk-register\..+\.previous-layer-\d+\.md$/u.test(file)) return ["R"];
  return [];
}

function scanDefinitions(file, lines, kinds, define) {
  let phase = null;
  let section = null;
  let item = null;
  lines.forEach((line, index) => {
    const at = { file, line: index + 1 };
    const heading = line.match(/^(#{2,3})\s+(.+?)\s*$/u);
    if (heading) {
      section = heading[1] === "##" ? heading[2] : section;
      phase = heading[1] === "###" ? heading[2] : heading[2] === "Follow-Up Tasks" ? "Follow-Up Tasks" : phase;
      item = null;
      return;
    }
    if (kinds.includes("T")) {
      const task = line.match(TASK_LINE);
      if (task) define(`T${Number(task[4])}`, { ...at, kind: "task", phase, status: task[3].trim(), title: task[5].trim() });
    }
    const bold = line.match(BOLD_DEFINITION);
    if (bold && kinds.includes(bold[1])) {
      define(`${bold[1]}${Number(bold[2])}`, {
        ...at,
        kind: KINDS[bold[1]],
        title: bold[3].replace(/\.$/u, "").trim(),
        ...(/\bResolved\b/u.test(bold[4]) ? { resolved: true } : {}),
      });
    }
    if (kinds.includes("H")) {
      const h = line.match(H_ITEM);
      if (h) {
        item = { id: `H${Number(h[1])}` };
        define(item.id, { ...at, kind: "human-queue", status: section === "Resolved" ? "resolved" : "open", title: null });
      } else if (item && /^\s+-\s+Ask:\s*/u.test(line)) {
        define(item.id, { title: line.replace(/^\s+-\s+Ask:\s*/u, "").trim() }, true);
      } else if (item && /^\s+-\s+Kind:\s*/u.test(line)) {
        define(item.id, { hold_kind: line.replace(/^\s+-\s+Kind:\s*/u, "").trim() }, true);
      }
    }
    if (kinds.includes("R")) {
      const risk = line.match(RISK_ROW);
      if (risk) {
        const cells = line.split("|").map((cell) => cell.trim());
        define(`R${Number(risk[1])}`, { ...at, kind: "risk", status: cells.at(-2) || null, title: risk[2] });
      }
    }
  });
}

// Builds the index of the epic at `epicDir`. Files are reported relative to it.
export function buildIdIndex(epicDir) {
  const ids = {};
  const aliases = {};
  const duplicates = [];
  const mentions = [];
  const files = listMarkdown(epicDir);

  for (const file of files) {
    const lines = fs.readFileSync(path.join(epicDir, file), "utf8").split("\n");
    const define = (id, entry, merge = false) => {
      if (merge) {
        Object.assign(ids[id], entry);
        return;
      }
      if (ids[id]) {
        duplicates.push({ first: { file: ids[id].file, line: ids[id].line }, id, second: { file: entry.file, line: entry.line } });
        return;
      }
      ids[id] = entry;
    };
    scanDefinitions(file, lines, homeKinds(file), define);
    lines.forEach((line, index) => {
      if (line.startsWith("Next task id:")) return;
      for (const match of line.matchAll(MENTION)) {
        const id = `${match[1]}${Number(match[3])}`;
        if (match[2]) aliases[`${match[1]}-${match[3]}`] = id;
        mentions.push({ file, id, line: index + 1 });
      }
    });
  }

  const unknown = mentions.filter((mention) => !ids[mention.id]);
  return { aliases, duplicates, files, ids, unknown };
}

// Resolves any form (`D16`, `d16`, `D-16`) to its index entry, or null.
export function resolveId(index, value) {
  const id = canonicalId(value);
  return id && index.ids[id] ? { id, ...index.ids[id] } : null;
}
