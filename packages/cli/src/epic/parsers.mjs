// Temporary duplicates of the read side of the skill's epic artifact parsers, for the epic app:
//   plugins/epic-loop/skills/epic-loop/scripts/lib/tracker-file.mjs   (scanTracker, read only)
//   plugins/epic-loop/skills/epic-loop/scripts/lib/task-ids.mjs       (splitTaskTitle)
//   plugins/epic-loop/skills/epic-loop/scripts/lib/human-queue.mjs    (parseHumanQueue)
//   plugins/epic-loop/skills/epic-loop/scripts/lib/agent-decisions.mjs (agent-made entries)
// The CLI cannot import the skill at runtime. Remove once the skill scripts migrate into this package.

const TASK_LINE = /^- \[([ xX])\]\s+Kind:\s*([^|]+)\|\s*Status:\s*([^|]+)\|\s*(.+)$/u;
const TITLE_ID = /^T(\d+)\s+·\s+(.*)$/u;
const DETAIL_LINE = /^\s+-\s+(Outcome|Surface|Acceptance|Docs|Method|Evidence):\s*(.*)$/u;
const HOLD_LINE = /^\s+-\s+Hold:\s*([a-z-]+)\s*\((H\d+)\)\s*$/u;
const PHASE_STATUS_LINE = /^- Phase status:\s*(\S+)\s*$/u;
const ARCHIVE_STUB = /^- Tasks:\s*(\d+)\s+closed tasks?\s+archived/u;
const FOLLOW_UP_HEADING = "Follow-Up Tasks";

export function splitTaskTitle(raw) {
  const text = String(raw ?? "").trim();
  const match = text.match(TITLE_ID);
  return match ? { tid: `T${Number(match[1])}`, title: match[2].trim() } : { tid: null, title: text };
}

function derivePhaseStatus(tasks) {
  if (tasks.some((task) => task.status === "doing")) return "doing";
  if (tasks.length > 0 && tasks.every((task) => task.status === "done")) return "done";
  return "todo";
}

// Phases with their tasks (id, kind, status, title, details, hold) and the follow-up tasks.
export function parseTracker(text) {
  const result = { follow_ups: [], phases: [], title: text.match(/^Epic:\s*(.+)$/mu)?.[1]?.trim() ?? null };
  let section = null;
  let phase = null;
  let task = null;

  for (const line of text.split("\n")) {
    const sectionMatch = line.match(/^##\s+(.+?)\s*$/u);
    if (sectionMatch) {
      section = sectionMatch[1];
      phase = null;
      task = null;
      continue;
    }
    const phaseMatch = line.match(/^###\s+(.+)$/u);
    if (phaseMatch) {
      const heading = phaseMatch[1].trim();
      const numbered = heading.match(/^Phase\s+(\d+)\s*[:-]\s*(.+)$/iu);
      phase = {
        archived: 0,
        heading,
        id: `phase-${numbered ? Number(numbered[1]) : result.phases.length + 1}`,
        intent: null,
        status: null,
        tasks: [],
        title: numbered ? numbered[2].trim() : heading,
      };
      result.phases.push(phase);
      task = null;
      continue;
    }
    if (phase && !task) {
      const status = line.match(PHASE_STATUS_LINE);
      if (status) {
        phase.status = status[1];
        continue;
      }
      const stub = line.match(ARCHIVE_STUB);
      if (stub) {
        phase.archived = Number(stub[1]);
        continue;
      }
      const intent = line.match(/^- Intent:\s*(.+)$/u);
      if (intent) {
        phase.intent = intent[1].trim();
        continue;
      }
    }
    const taskMatch = line.match(TASK_LINE);
    if (taskMatch && (phase || section === FOLLOW_UP_HEADING)) {
      const { tid, title } = splitTaskTitle(taskMatch[4]);
      task = { details: {}, hold: null, kind: taskMatch[2].trim(), status: taskMatch[3].trim(), tid, title };
      (phase ? phase.tasks : result.follow_ups).push(task);
      continue;
    }
    if (task && /^\s+\S/u.test(line)) {
      const hold = line.match(HOLD_LINE);
      if (hold) task.hold = { item: hold[2], kind: hold[1] };
      const detail = line.match(DETAIL_LINE);
      if (detail && !task.details[detail[1].toLowerCase()]) task.details[detail[1].toLowerCase()] = detail[2].trim();
    } else if (task && line.trim()) {
      task = null;
    }
  }
  for (const item of result.phases) item.status ??= derivePhaseStatus(item.tasks);
  return result;
}

export function parseHumanQueue(text) {
  const items = [];
  let section = null;
  let current = null;
  for (const line of text.split(/\r?\n/u)) {
    const heading = line.match(/^##\s+(Open|Resolved)\s*$/u);
    if (heading) {
      section = heading[1] === "Open" ? "open" : "resolved";
      current = null;
      continue;
    }
    const itemMatch = line.match(/^- \*\*H(\d+)\*\*\s*$/u);
    if (itemMatch && section) {
      current = { id: `H${itemMatch[1]}`, number: Number(itemMatch[1]), status: section };
      items.push(current);
      continue;
    }
    const field = line.match(/^ {2}- ([A-Z][a-z]+): (.*)$/u);
    if (field && current) current[field[1].toLowerCase()] = field[2];
  }
  return items;
}

const AGENT_ENTRY = /^- \*\*D(\d+) — (.+)\*\* \((\d{4}-\d{2}-\d{2}); agent-made, stop class ([A-F]); (unconfirmed|confirmed \d{4}-\d{2}-\d{2}|reversed \d{4}-\d{2}-\d{2})\)\.$/u;

export function parseAgentDecisions(text) {
  const lines = text.split("\n");
  const decisions = [];
  lines.forEach((line, index) => {
    const match = line.match(AGENT_ENTRY);
    if (!match) return;
    let defaultTaken = null;
    for (let next = index + 1; next < lines.length && /^\s{2}-/u.test(lines[next]); next += 1) {
      const field = lines[next].match(/^\s{2}- Default taken:\s*(.*)$/u);
      if (field) defaultTaken = field[1].trim();
    }
    decisions.push({ date: match[3], default: defaultTaken, id: `D${match[1]}`, state: match[5].split(" ")[0], stop_class: match[4], title: match[2] });
  });
  return decisions;
}

export function readStateLine(text, label) {
  const match = text.match(new RegExp(`^${label}:\\s*(.+)$`, "imu"));
  const value = match?.[1]?.trim().replace(/^`|`$/gu, "") ?? null;
  return !value || /^(none|null|n\/a|tbd)$/iu.test(value) ? null : value;
}

// The epic's intent: the first paragraph of `## Intent`, `## Desired Outcome` or `## Problem`
// in docs/problem-framing.md, else its first paragraph.
export function readIntent(text) {
  const blocks = text.split(/\n(?=##\s)/u);
  const pick = ["Intent", "Desired Outcome", "Problem"].map((name) => blocks.find((block) => new RegExp(`^##\\s+${name}\\s*$`, "mu").test(block.split("\n")[0]))).find(Boolean);
  const body = (pick ?? text)
    .split("\n")
    .filter((line) => !line.startsWith("#"))
    .join("\n");
  const paragraph = body
    .split(/\n\s*\n/u)
    .map((part) => part.trim())
    .find((part) => part && !/^[-*\d]/u.test(part));
  return paragraph ? paragraph.replace(/\s+/gu, " ") : null;
}
