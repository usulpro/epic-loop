import { slugify } from "./common.mjs";

// tracker.md is the source of truth for phases and tasks. scanTracker reads the roadmap model
// out of it together with the line positions that task and phase scripts patch in place;
// patchTrackerText changes only the lines whose state differs and leaves every other byte.

const TASK_LINE = /^- \[([ xX])\]\s+Kind:\s*([^|]+)\|\s*Status:\s*([^|]+)\|\s*(.+)$/u;
const DETAIL_LINE = /^\s+-\s+(Outcome|Surface|Acceptance|Docs):\s*(.*)$/u;
const HOLD_LINE = /^(\s+)-\s+Hold:\s*([a-z-]+)\s*\((H\d+)\)\s*$/u;
const PHASE_STATUS_LINE = /^- Phase status:\s*(\S+)\s*$/u;
const FOLLOW_UP_HEADING = "Follow-Up Tasks";

export function scanTracker(text) {
  const lines = text.split("\n");
  const scan = {
    follow_ups: [],
    followUpSection: null,
    lines,
    phaseRefs: new Map(),
    phases: [],
    statusList: null,
    taskRefs: new Map(),
    title: text.match(/^Epic:\s*(.+)$/mu)?.[1]?.trim() ?? null,
  };
  let section = null;
  let phase = null;
  let task = null;
  let taskNumber = 0;

  lines.forEach((line, index) => {
    const sectionMatch = line.match(/^##\s+(.+?)\s*$/u);
    if (sectionMatch) {
      section = sectionMatch[1];
      phase = null;
      task = null;
      if (section === FOLLOW_UP_HEADING) {
        scan.followUpSection = { endIndex: index, headingIndex: index };
      }
      if (section === "Task Statuses") {
        scan.statusList = { blockedIndex: null, hasOnHold: false };
      }
      return;
    }

    const phaseMatch = line.match(/^###\s+(.+)$/u);
    if (phaseMatch) {
      phase = createPhaseFromHeading(phaseMatch[1] ?? "", scan.phases.length + 1);
      scan.phases.push(phase);
      scan.phaseRefs.set(phase.id, { headingIndex: index, statusIndex: null });
      section = null;
      task = null;
      taskNumber = 0;
      return;
    }

    if (section === "Task Statuses") {
      readStatusListLine(scan.statusList, line, index);
      return;
    }

    if (section === FOLLOW_UP_HEADING && line.trim()) {
      scan.followUpSection.endIndex = index;
    }

    const statusMatch = phase && !task ? line.match(PHASE_STATUS_LINE) : null;
    if (statusMatch) {
      phase.explicit_status = statusMatch[1];
      scan.phaseRefs.get(phase.id).statusIndex = index;
      return;
    }

    const taskMatch = line.match(TASK_LINE);
    if (taskMatch && (phase || section === FOLLOW_UP_HEADING)) {
      task = createTask(taskMatch, phase ? `${phase.id}-task-${++taskNumber}` : followUpId(scan.follow_ups.length + 1, taskMatch[4]));
      (phase ? phase.tasks : scan.follow_ups).push(task);
      scan.taskRefs.set(task.id, { holdIndex: null, lineIndex: index });
      return;
    }

    if (task && /^\s+\S/u.test(line)) {
      readTaskDetail(scan, task, line, index);
    } else if (task && line.trim()) {
      task = null;
    }
  });

  for (const item of scan.phases) {
    item.status = item.explicit_status ?? derivePhaseStatus(item);
    delete item.explicit_status;
  }
  return scan;
}

export function patchTrackerText(scan, roadmap, formatTask) {
  const ops = [];

  for (const phase of roadmap.phases) {
    const before = scan.phases.find((item) => item.id === phase.id);
    const ref = scan.phaseRefs.get(phase.id);
    if (before && ref && before.status !== phase.status) {
      ops.push(
        ref.statusIndex === null
          ? { index: ref.headingIndex, insert: ["", `- Phase status: ${phase.status}`] }
          : { index: ref.statusIndex, replace: scan.lines[ref.statusIndex].replace(/(Phase status:\s*)\S+/u, `$1${phase.status}`) },
      );
    }
    for (const task of phase.tasks) {
      ops.push(
        ...taskOps(
          scan,
          task,
          before?.tasks.find((item) => item.id === task.id),
        ),
      );
    }
  }

  const knownFollowUps = new Set(scan.follow_ups.map((task) => task.id));
  for (const task of roadmap.follow_ups ?? []) {
    ops.push(
      ...taskOps(
        scan,
        task,
        scan.follow_ups.find((item) => item.id === task.id),
      ),
    );
  }

  const usesOnHold = [...roadmap.phases.flatMap((phase) => phase.tasks), ...(roadmap.follow_ups ?? [])].some((task) => task.status === "on-hold");
  if (usesOnHold && scan.statusList && !scan.statusList.hasOnHold && scan.statusList.blockedIndex !== null) {
    ops.push({ index: scan.statusList.blockedIndex, insert: ["- on-hold"] });
  }

  const added = (roadmap.follow_ups ?? []).filter((task) => !knownFollowUps.has(task.id));
  const addedLines = added.flatMap((task) => trimTrailingBlank(formatTask(task)).concat([""])).slice(0, -1);
  if (added.length > 0 && scan.followUpSection) {
    ops.push({ index: scan.followUpSection.endIndex, insert: ["", ...addedLines] });
  }

  const lines = [...scan.lines];
  // Bottom-up, so earlier indexes stay valid while later lines are inserted or removed.
  for (const op of ops.sort((left, right) => right.index - left.index)) {
    if (op.remove) {
      lines.splice(op.index, 1);
    } else if (op.insert) {
      lines.splice(op.index + 1, 0, ...op.insert);
    } else {
      lines[op.index] = op.replace;
    }
  }

  let text = lines.join("\n");
  if (added.length > 0 && !scan.followUpSection) {
    const separator = text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : "\n\n";
    text = `${text}${separator}## ${FOLLOW_UP_HEADING}\n\n${addedLines.join("\n")}\n`;
  }
  return text;
}

function taskOps(scan, task, before) {
  const ref = scan.taskRefs.get(task.id);
  if (!before || !ref) {
    return [];
  }

  const ops = [];
  if (before.status !== task.status) {
    const line = scan.lines[ref.lineIndex].replace(/^- \[[ xX]\]/u, `- [${task.status === "done" ? "x" : " "}]`).replace(/(\|\s*Status:\s*)[^|]*?(\s*\|)/u, `$1${task.status}$2`);
    ops.push({ index: ref.lineIndex, replace: line });
  }

  const holdLine = task.hold ? `  - Hold: ${task.hold.kind} (${task.hold.item})` : null;
  if (holdKey(before.hold) !== holdKey(task.hold)) {
    if (ref.holdIndex !== null && !holdLine) {
      ops.push({ index: ref.holdIndex, remove: true });
    } else if (ref.holdIndex !== null) {
      ops.push({ index: ref.holdIndex, replace: holdLine });
    } else {
      ops.push({ index: ref.lineIndex, insert: [holdLine] });
    }
  }
  return ops;
}

function readTaskDetail(scan, task, line, index) {
  const hold = line.match(HOLD_LINE);
  if (hold) {
    task.hold = { item: hold[3], kind: hold[2] };
    scan.taskRefs.get(task.id).holdIndex = index;
    return;
  }

  const detail = line.match(DETAIL_LINE);
  if (detail && task[detail[1].toLowerCase()] === null) {
    task[detail[1].toLowerCase()] = detail[2].trim();
  }
}

function readStatusListLine(statusList, line, index) {
  const item = line.match(/^- (\S+)\s*$/u)?.[1];
  if (item === "blocked") {
    statusList.blockedIndex = index;
  }
  if (item === "on-hold") {
    statusList.hasOnHold = true;
  }
}

function createTask(match, id) {
  return {
    id,
    title: (match[4] ?? "").trim(),
    kind: (match[2] ?? "implementation").trim(),
    status: (match[3] ?? (match[1].toLowerCase() === "x" ? "done" : "todo")).trim(),
    outcome: null,
    surface: null,
    acceptance: null,
    docs: null,
    hold: null,
  };
}

export function followUpId(number, title) {
  return `follow-up-${String(number).padStart(2, "0")}-${slugify(title).slice(0, 40)}`;
}

export function createPhaseFromHeading(heading, fallbackNumber) {
  const match = heading.match(/^Phase\s+(\d+)\s*[:-]\s*(.+)$/iu);
  const number = match ? Number(match[1]) : fallbackNumber;
  const title = match ? match[2].trim() : heading.trim();
  return {
    id: `phase-${number}`,
    title,
    status: "todo",
    tasks: [],
  };
}

export function derivePhaseStatus(phase) {
  if (phase.tasks.some((task) => task.status === "doing")) {
    return "doing";
  }
  if (phase.tasks.length > 0 && phase.tasks.every((task) => task.status === "done")) {
    return "done";
  }
  return phase.status ?? "todo";
}

function holdKey(hold) {
  return hold ? `${hold.kind}:${hold.item}` : "";
}

function trimTrailingBlank(lines) {
  const result = [...lines];
  while (result.length > 0 && result.at(-1) === "") {
    result.pop();
  }
  return result;
}
