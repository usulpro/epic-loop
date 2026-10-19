import fs from "node:fs";
import path from "node:path";

// Stable task ids (decision D27 of the visual-review epic). Every task line in tracker.md carries
// `T<n> · ` at the start of its title part:
//   - [ ] Kind: implementation | Status: todo | T12 · Gate lifecycle in the loop state
// The line still matches the older parser (the id is part of its title), so a tracker migrated
// here stays readable by an older runtime copy, and positional ids (`phase-N-task-k`) keep working.
// Ids are numbered across the epic in tracker order and never reused: the tracker header keeps
// `Next task id: T<n>`, and the archive layers (tracker.*.previous-layer-*.md) count too.
// This module has no imports from the rest of the skill so the CLI can keep a copy of it.

const TASK_LINE = /^- \[([ xX])\]\s+Kind:\s*([^|]+)\|\s*Status:\s*([^|]+)\|\s*(.+)$/u;
const TITLE_ID = /^T(\d+)\s+·\s+(.*)$/u;
const NEXT_ID_LINE = /^Next task id:\s*T(\d+)\s*$/u;
const FOLLOW_UP_HEADING = "Follow-Up Tasks";

// "T12 · Title" -> { tid: "T12", title: "Title" }; a title without an id is returned as is.
export function splitTaskTitle(raw) {
  const text = String(raw ?? "").trim();
  const match = text.match(TITLE_ID);
  return match ? { tid: `T${Number(match[1])}`, title: match[2].trim() } : { tid: null, title: text };
}

export function formatTaskTitle(task) {
  return task.tid ? `${task.tid} · ${task.title}` : task.title;
}

// `T12`, `t12`, `T-12` -> "T12"; anything else -> null.
export function normalizeTaskId(value) {
  const match = String(value ?? "")
    .trim()
    .match(/^t-?(\d+)$/iu);
  return match ? `T${Number(match[1])}` : null;
}

function taskIdNumbers(text) {
  return text
    .split("\n")
    .map((line) => line.match(TASK_LINE))
    .filter(Boolean)
    .map((match) => splitTaskTitle(match[4]).tid)
    .filter(Boolean)
    .map((tid) => Number(tid.slice(1)));
}

export function archiveLayerFiles(epicDir) {
  try {
    return fs
      .readdirSync(epicDir)
      .filter((name) => /^tracker\..+\.previous-layer-\d+\.md$/u.test(name))
      .sort()
      .map((name) => path.join(epicDir, name));
  } catch {
    return [];
  }
}

export function archiveMaxTaskId(epicDir) {
  return Math.max(0, ...archiveLayerFiles(epicDir).flatMap((file) => taskIdNumbers(fs.readFileSync(file, "utf8"))));
}

// Assigns T<n> to every task line without one, in tracker order (phases, then follow-ups), and
// keeps the `Next task id` header line current. Deterministic and idempotent: a tracker that
// already carries ids and a current header comes back byte for byte.
export function assignTrackerTaskIds(text, archiveMax = 0, { header = true, start = 1 } = {}) {
  const lines = text.split("\n");
  const headerIndex = lines.findIndex((line) => NEXT_ID_LINE.test(line));
  const headerNext = headerIndex === -1 ? 1 : Number(lines[headerIndex].match(NEXT_ID_LINE)[1]);
  let next = Math.max(start, headerNext, archiveMax + 1, Math.max(0, ...taskIdNumbers(text)) + 1);

  let inTasks = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const section = line.match(/^##\s+(.+?)\s*$/u)?.[1];
    if (section) inTasks = section === "Active Roadmap" || section === FOLLOW_UP_HEADING;
    if (/^###\s+/u.test(line)) inTasks = true;
    const match = inTasks ? line.match(TASK_LINE) : null;
    if (!match || splitTaskTitle(match[4]).tid) continue;
    const prefixEnd = line.length - match[4].length;
    lines[index] = `${line.slice(0, prefixEnd)}T${next} · ${match[4].trim()}`;
    next += 1;
  }

  if (!header) return lines.join("\n");
  const headerLine = `Next task id: T${next}`;
  if (headerIndex !== -1) {
    lines[headerIndex] = headerLine;
  } else {
    const epicIndex = lines.findIndex((line) => /^Epic:\s*/u.test(line));
    const titleIndex = lines.findIndex((line) => /^#\s+/u.test(line));
    const at = epicIndex !== -1 ? epicIndex : titleIndex;
    if (at === -1) lines.unshift(headerLine, "");
    else lines.splice(at + 1, 0, "", headerLine);
  }
  return lines.join("\n");
}

// Migrates (or keeps current) the ids of an epic's tracker on disk: tracker.md first, then the
// archive layers in file-name order, then the `Next task id` header. Returns true when it wrote.
export function ensureTrackerTaskIds(epicDir) {
  const trackerPath = path.join(epicDir, "tracker.md");
  if (!fs.existsSync(trackerPath)) return false;
  let wrote = false;
  const write = (file, before, after) => {
    if (after === before) return;
    fs.writeFileSync(file, after, "utf8");
    wrote = true;
  };
  const tracker = fs.readFileSync(trackerPath, "utf8");
  let trackerText = assignTrackerTaskIds(tracker, archiveMaxTaskId(epicDir));
  for (const file of archiveLayerFiles(epicDir)) {
    const before = fs.readFileSync(file, "utf8");
    const start = Number(trackerText.match(/^Next task id:\s*T(\d+)\s*$/mu)[1]);
    const after = assignTrackerTaskIds(before, 0, { header: false, start });
    write(file, before, after);
    trackerText = assignTrackerTaskIds(trackerText, Math.max(0, ...taskIdNumbers(after)));
  }
  write(trackerPath, tracker, trackerText);
  return wrote;
}

export function nextTaskIdNumber(text, archiveMax = 0) {
  return Number(assignTrackerTaskIds(text, archiveMax).match(/^Next task id:\s*T(\d+)\s*$/mu)[1]);
}
