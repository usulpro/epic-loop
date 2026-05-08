import fs from "node:fs";
import path from "node:path";

import { ensureDir, epicsRoot, nowIso, readJson, requireFlag, resolveRoot, roadmapStatePath, runtimeStatePath, slugify, writeJson } from "./common.mjs";

export const TASK_STATUSES = ["todo", "doing", "need-review", "blocked", "partially-satisfied", "deferred", "reset-required", "done"];
export const TASK_KINDS = ["implementation", "verification", "review", "follow-up", "architecture-reset", "documentation-only"];

export function createInitialRoadmapState({ slug, title }) {
  return {
    schema_version: 1,
    slug,
    title,
    active_phase_id: "phase-1",
    active_task_id: null,
    statuses: TASK_STATUSES,
    kinds: TASK_KINDS,
    phases: [
      {
        id: "phase-1",
        title: "Shape The Epic",
        status: "todo",
        tasks: [
          {
            id: "phase-1-task-1",
            title: "Capture problem framing",
            kind: "documentation-only",
            status: "todo",
            review_status: null,
            outcome: "The epic has enough structure for phase and task decomposition.",
            surface: "`docs/`, `decision-log.md`, `risk-register.md`, `state-of-epic.md`.",
            acceptance: "A future session can understand why this epic exists and what should happen next.",
            docs: "`docs/problem-framing.md`, `decision-log.md`, `risk-register.md`.",
          },
        ],
      },
    ],
    follow_ups: [],
    updated_at: nowIso(),
  };
}

export function ensureRoadmapState(projectRoot, slug, { title } = {}) {
  const filePath = roadmapStatePath(projectRoot, slug);
  const existing = normalizeRoadmap(readJson(filePath, null));
  if (existing) {
    return existing;
  }

  const imported = importRoadmapFromTracker(projectRoot, slug, { title });
  writeRoadmapState(projectRoot, slug, imported);
  return imported;
}

export function readRoadmapSummary(projectRoot, slug) {
  const roadmap = ensureRoadmapState(projectRoot, slug);
  return {
    active_phase: displayPhase(findPhase(roadmap, roadmap.active_phase_id)),
    active_task: displayTask(roadmap, findTask(roadmap, roadmap.active_task_id)),
  };
}

export function renderTracker(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const roadmap = ensureRoadmapState(root, slug);
  renderTrackerMarkdown(root, slug, roadmap);
  console.log(`Rendered tracker for ${slug}.`);
}

export function setTaskStatus(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const taskId = requireFlag(flags, "task-id");
  const status = requireFlag(flags, "status");
  const roadmap = ensureRoadmapState(root, slug);
  assertStatus(status);
  const task = requireTask(roadmap, taskId);
  const phase = findTaskPhase(roadmap, task.id);
  task.status = status;
  if (status === "doing") {
    task.review_status = null;
    roadmap.active_task_id = task.id;
    if (phase) {
      phase.status = "doing";
      roadmap.active_phase_id = phase.id;
    }
  } else if (status === "need-review") {
    task.review_status = "pending";
    roadmap.active_task_id = task.id;
    if (phase) {
      phase.status = "need-review";
      roadmap.active_phase_id = phase.id;
    }
  } else {
    task.review_status = null;
  }
  finalizeRoadmapMutation(root, slug, roadmap);
  console.log(`Task ${task.id} status: ${status}`);
}

export function startTask(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const taskId = requireFlag(flags, "task-id");
  const roadmap = ensureRoadmapState(root, slug);
  const task = requireTask(roadmap, taskId);
  const phase = findTaskPhase(roadmap, task.id);
  task.status = "doing";
  task.review_status = null;
  if (phase) {
    phase.status = "doing";
  }
  roadmap.active_task_id = task.id;
  roadmap.active_phase_id = phase?.id ?? roadmap.active_phase_id;
  finalizeRoadmapMutation(root, slug, roadmap);
  console.log(`Started task ${task.id}.`);
}

export function closeTask(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const taskId = requireFlag(flags, "task-id");
  const roadmap = ensureRoadmapState(root, slug);
  const task = requireTask(roadmap, taskId);
  task.status = "done";
  task.review_status = null;
  if (roadmap.active_task_id === task.id) {
    roadmap.active_task_id = null;
  }
  finalizeRoadmapMutation(root, slug, roadmap);
  console.log(`Closed task ${task.id}.`);
}

export function setTaskReviewStatus(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const taskId = requireFlag(flags, "task-id");
  const reviewStatus = requireFlag(flags, "review-status");
  const roadmap = ensureRoadmapState(root, slug);
  assertReviewStatus(reviewStatus);
  const task = requireTask(roadmap, taskId);
  if (task.status !== "need-review") {
    throw new Error(`Task ${task.id} is not in need-review status.`);
  }
  task.review_status = reviewStatus;
  if (reviewStatus === "pending") {
    const phase = findTaskPhase(roadmap, task.id);
    roadmap.active_task_id = task.id;
    if (phase) {
      phase.status = "need-review";
      roadmap.active_phase_id = phase.id;
    }
  } else if (roadmap.active_task_id === task.id) {
    roadmap.active_task_id = null;
  }
  finalizeRoadmapMutation(root, slug, roadmap);
  console.log(`Task ${task.id} review status: ${reviewStatus}`);
}

export function setActiveTask(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const taskId = requireFlag(flags, "task-id");
  const roadmap = ensureRoadmapState(root, slug);
  const task = requireTask(roadmap, taskId);
  const phase = findTaskPhase(roadmap, task.id);
  roadmap.active_task_id = task.id;
  if (phase) {
    phase.status = task.status === "need-review" ? "need-review" : phase.status === "done" ? "done" : "doing";
  }
  roadmap.active_phase_id = phase?.id ?? roadmap.active_phase_id;
  finalizeRoadmapMutation(root, slug, roadmap);
  console.log(`Active task for ${slug}: ${displayTask(roadmap, task)}`);
}

export function setActivePhase(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const phaseId = requireFlag(flags, "phase-id");
  const roadmap = ensureRoadmapState(root, slug);
  const phase = requirePhase(roadmap, phaseId);
  roadmap.active_phase_id = phase.id;
  finalizeRoadmapMutation(root, slug, roadmap);
  console.log(`Active phase for ${slug}: ${displayPhase(phase)}`);
}

export function startPhase(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const phaseId = requireFlag(flags, "phase-id");
  const roadmap = ensureRoadmapState(root, slug);
  const phase = requirePhase(roadmap, phaseId);
  phase.status = "doing";
  roadmap.active_phase_id = phase.id;
  finalizeRoadmapMutation(root, slug, roadmap);
  console.log(`Started phase ${phase.id}.`);
}

export function closePhase(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const phaseId = requireFlag(flags, "phase-id");
  const roadmap = ensureRoadmapState(root, slug);
  const phase = requirePhase(roadmap, phaseId);
  phase.status = "done";
  finalizeRoadmapMutation(root, slug, roadmap);
  console.log(`Closed phase ${phase.id}.`);
}

export function addFollowUpTask(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const title = requireFlag(flags, "title");
  const roadmap = ensureRoadmapState(root, slug);
  const followUps = Array.isArray(roadmap.follow_ups) ? roadmap.follow_ups : [];
  const id = `follow-up-${String(followUps.length + 1).padStart(2, "0")}-${slugify(title).slice(0, 40)}`;
  followUps.push({
    id,
    title,
    kind: flags.kind || "follow-up",
    status: flags.status || "todo",
    review_status: null,
    outcome: flags.outcome || null,
    surface: flags.surface || null,
    acceptance: flags.acceptance || null,
    docs: flags.docs || null,
  });
  roadmap.follow_ups = followUps;
  finalizeRoadmapMutation(root, slug, roadmap);
  console.log(`Added follow-up task ${id}.`);
}

export function renderTrackerMarkdown(projectRoot, slug, roadmap = ensureRoadmapState(projectRoot, slug)) {
  const trackerPath = path.join(epicsRoot(projectRoot), slug, "tracker.md");
  ensureDir(path.dirname(trackerPath));
  fs.writeFileSync(trackerPath, trackerMarkdown(roadmap), "utf8");
}

function finalizeRoadmapMutation(projectRoot, slug, roadmap) {
  refreshPhaseStatuses(roadmap);
  roadmap.updated_at = nowIso();
  writeRoadmapState(projectRoot, slug, roadmap);
  renderTrackerMarkdown(projectRoot, slug, roadmap);
  syncActiveState(projectRoot, slug, roadmap);
}

function writeRoadmapState(projectRoot, slug, roadmap) {
  writeJson(roadmapStatePath(projectRoot, slug), normalizeRoadmap(roadmap) ?? roadmap);
}

function syncActiveState(projectRoot, slug, roadmap) {
  const activePhase = displayPhase(findPhase(roadmap, roadmap.active_phase_id));
  const activeTask = displayTask(roadmap, findTask(roadmap, roadmap.active_task_id));
  const statePath = path.join(epicsRoot(projectRoot), slug, "state-of-epic.md");

  if (fs.existsSync(statePath)) {
    let text = fs.readFileSync(statePath, "utf8");
    text = replaceStateLine(text, "Active phase", activePhase ?? "TBD");
    text = replaceStateLine(text, "Active task", activeTask ?? "TBD");
    fs.writeFileSync(statePath, text, "utf8");
  }

  const runtimePath = runtimeStatePath(projectRoot, slug);
  const runtime = readJson(runtimePath, {});
  writeJson(runtimePath, {
    ...runtime,
    active_phase: activePhase ?? null,
    active_task: activeTask ?? null,
    updated_at: nowIso(),
  });
}

function replaceStateLine(text, label, value) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pattern = new RegExp(`^${escaped}:.*$`, "mu");
  if (pattern.test(text)) {
    return text.replace(pattern, `${label}: ${value}`);
  }
  return `${text.trimEnd()}\n${label}: ${value}\n`;
}

function importRoadmapFromTracker(projectRoot, slug, { title } = {}) {
  const trackerPath = path.join(epicsRoot(projectRoot), slug, "tracker.md");
  if (!fs.existsSync(trackerPath)) {
    return createInitialRoadmapState({ slug, title: title || slug });
  }

  const text = fs.readFileSync(trackerPath, "utf8");
  const roadmap = {
    schema_version: 1,
    slug,
    title: title || readTrackerTitle(text) || slug,
    active_phase_id: null,
    active_task_id: null,
    statuses: TASK_STATUSES,
    kinds: TASK_KINDS,
    phases: [],
    follow_ups: [],
    updated_at: nowIso(),
  };
  let currentPhase = null;
  let currentTask = null;
  let currentSection = "active";
  const followUps = roadmap.follow_ups;

  for (const rawLine of text.split(/\r?\n/u)) {
    const phaseMatch = rawLine.match(/^###\s+(.+)$/u);
    if (phaseMatch) {
      currentPhase = createPhaseFromHeading(phaseMatch[1] ?? "", roadmap.phases.length + 1);
      roadmap.phases.push(currentPhase);
      currentTask = null;
      currentSection = "active";
      continue;
    }

    if (rawLine.match(/^##\s+Follow-Up Tasks$/u)) {
      currentPhase = null;
      currentTask = null;
      currentSection = "follow-ups";
      continue;
    }

    const taskMatch = rawLine.match(/^- \[([ xX])\]\s+T(\d+)\.(\d+)\s+\[(.+)\]\s*$/u);
    if (taskMatch) {
      const parsedPhaseNumber = Number(taskMatch[2]);
      const parsedTaskNumber = Number(taskMatch[3]);
      const title = (taskMatch[4] ?? "").trim();
      const checked = taskMatch[1].toLowerCase() === "x";
      if (currentSection === "follow-ups") {
        currentTask = {
          id: `follow-up-${String(followUps.length + 1).padStart(2, "0")}-${slugify(title).slice(0, 40)}`,
          title,
          kind: "follow-up",
          status: checked ? "done" : "todo",
          review_status: null,
          _importedChecked: checked,
          outcome: null,
          surface: null,
          acceptance: null,
          docs: null,
        };
        followUps.push(currentTask);
        continue;
      }

      if (!currentPhase) {
        continue;
      }

      const phaseId = currentPhase.id ?? `phase-${Number.isFinite(parsedPhaseNumber) ? parsedPhaseNumber : roadmap.phases.length + 1}`;
      currentTask = {
        id: `${phaseId}-task-${parsedTaskNumber}`,
        title,
        kind: "implementation",
        status: checked ? "done" : "todo",
        review_status: null,
        _importedChecked: checked,
        outcome: null,
        surface: null,
        acceptance: null,
        docs: null,
      };
      currentPhase.tasks.push(currentTask);
      if (currentTask.status === "doing") {
        roadmap.active_phase_id = phaseId;
        roadmap.active_task_id = currentTask.id;
      }
      continue;
    }

    if (!currentTask) {
      continue;
    }

    const metaMatch = rawLine.match(/^Kind:\s*([^|]+)\|\s*Status:\s*([^|]+)\s*$/u);
    if (metaMatch) {
      currentTask.kind = (metaMatch[1] ?? currentTask.kind).trim();
      currentTask.status = (metaMatch[2] ?? currentTask.status).trim();
      currentTask.review_status = currentTask.status === "need-review" ? (currentTask._importedChecked ? "done" : "pending") : null;
      delete currentTask._importedChecked;
      if (currentSection === "active" && currentTask.status === "doing") {
        roadmap.active_phase_id = currentPhase?.id ?? roadmap.active_phase_id;
        roadmap.active_task_id = currentTask.id;
      }
      continue;
    }

    const detailMatch = rawLine.match(/^\s+-\s+(Outcome|Surface|Acceptance|Docs):\s*(.*)$/u);
    if (detailMatch) {
      currentTask[detailMatch[1].toLowerCase()] = detailMatch[2].trim();
    }
  }

  for (const phase of roadmap.phases) {
    phase.status = derivePhaseStatus(phase);
  }

  roadmap.active_phase_id ??= roadmap.phases.find((phase) => phase.status === "doing")?.id ?? roadmap.phases[0]?.id ?? null;
  return roadmap.phases.length > 0 ? roadmap : createInitialRoadmapState({ slug, title: title || slug });
}

function trackerMarkdown(roadmap) {
  return [
    "# Tracker",
    "",
    `Epic: ${roadmap.title}`,
    "",
    "## Task Statuses",
    "",
    ...TASK_STATUSES.map((status) => `- ${status}`),
    "",
    "## Task Kinds",
    "",
    ...TASK_KINDS.map((kind) => `- ${kind}`),
    "",
    "## Active Roadmap",
    "",
    ...roadmap.phases.flatMap(formatPhase),
    ...(roadmap.follow_ups?.length ? ["## Follow-Up Tasks", "", ...roadmap.follow_ups.flatMap((task, index) => formatTask(task, roadmap.phases.length + 1, index + 1))] : []),
    "",
  ].join("\n");
}

function formatPhase(phase) {
  const phaseNumberValue = phaseNumber(phase);
  return [`### ${phaseHeading(phase)}`, "", `- Phase status: ${phase.status ?? "todo"}`, "", ...phase.tasks.flatMap((task, index) => formatTask(task, phaseNumberValue, index + 1))];
}

function formatTask(task, phaseNumberValue, taskNumber) {
  const checked = isTaskCompleteForDisplay(task) ? "x" : " ";
  const lines = [`- [${checked}] T${phaseNumberValue}.${taskNumber} [${task.title}]`, `Kind: ${task.kind} | Status: ${task.status}`];
  if (task.outcome) lines.push(`  - Outcome: ${task.outcome}`);
  if (task.surface) lines.push(`  - Surface: ${task.surface}`);
  if (task.acceptance) lines.push(`  - Acceptance: ${task.acceptance}`);
  if (task.docs) lines.push(`  - Docs: ${task.docs}`);
  lines.push("");
  return lines;
}

function createPhaseFromHeading(heading, fallbackNumber) {
  const match = heading.match(/^Phase\s+(\d+)\s*[:\-]\s*(.+)$/iu);
  const number = match ? Number(match[1]) : fallbackNumber;
  const title = match ? match[2].trim() : heading.trim();
  return {
    id: `phase-${number}`,
    title,
    status: "todo",
    tasks: [],
  };
}

function phaseHeading(phase) {
  const number = phaseNumber(phase);
  return `Phase ${number}: ${phase.title}`;
}

function displayPhase(phase) {
  if (!phase) {
    return null;
  }
  return `Phase ${phaseNumber(phase)} - ${phase.title}`;
}

function displayTask(roadmap, task) {
  if (!task) {
    return null;
  }
  const phase = findTaskPhase(roadmap, task.id);
  const taskNumber = taskNumberInPhase(phase, task.id);
  return `T${phaseNumber(phase)}.${taskNumber} [${stripFinalPeriod(task.title)}]`;
}

function phaseNumber(phase) {
  return Number(phase?.id?.match(/^phase-(\d+)$/u)?.[1] ?? 0);
}

function taskNumberInPhase(phase, taskId) {
  const match = taskId?.match(/-task-(\d+)$/u)?.[1];
  if (match) {
    return Number(match);
  }
  if (!phase) {
    return "?";
  }
  const index = phase.tasks.findIndex((item) => item.id === taskId);
  return index >= 0 ? index + 1 : "?";
}

function stripFinalPeriod(value) {
  return String(value ?? "").replace(/\.$/u, "");
}

function readTrackerTitle(text) {
  return text.match(/^Epic:\s*(.+)$/mu)?.[1]?.trim() ?? null;
}

function findPhase(roadmap, phaseId) {
  return roadmap.phases.find((phase) => phase.id === phaseId) ?? null;
}

function findTask(roadmap, taskId) {
  if (!taskId) {
    return null;
  }
  for (const phase of roadmap.phases) {
    const task = phase.tasks.find((item) => item.id === taskId);
    if (task) {
      return task;
    }
  }
  return null;
}

function findTaskPhase(roadmap, taskId) {
  return roadmap.phases.find((phase) => phase.tasks.some((task) => task.id === taskId)) ?? null;
}

function requirePhase(roadmap, phaseId) {
  const phase = findPhase(roadmap, phaseId);
  if (!phase) {
    throw new Error(`Phase not found: ${phaseId}`);
  }
  return phase;
}

function requireTask(roadmap, taskId) {
  const task = findTask(roadmap, taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  return task;
}

function derivePhaseStatus(phase) {
  if (phase.tasks.some((task) => task.status === "doing")) {
    return "doing";
  }
  if (phase.tasks.some((task) => task.status === "need-review" && task.review_status !== "done")) {
    return "need-review";
  }
  if (phase.tasks.length > 0 && phase.tasks.every(isTaskCompleteForPhase)) {
    return "done";
  }
  return phase.status ?? "todo";
}

function refreshPhaseStatuses(roadmap) {
  for (const phase of roadmap.phases) {
    phase.status = derivePhaseStatus(phase);
  }
}

function assertStatus(status) {
  if (!TASK_STATUSES.includes(status)) {
    throw new Error(`Invalid task status "${status}". Expected one of: ${TASK_STATUSES.join(", ")}.`);
  }
}

function assertReviewStatus(reviewStatus) {
  if (!["pending", "done"].includes(reviewStatus)) {
    throw new Error(`Invalid review status "${reviewStatus}". Expected one of: pending, done.`);
  }
}

function isTaskCompleteForPhase(task) {
  if (task.status === "done") {
    return true;
  }
  if (task.status === "need-review") {
    return task.review_status === "done";
  }
  return false;
}

function isTaskCompleteForDisplay(task) {
  if (task.status === "done") {
    return true;
  }
  if (task.status === "need-review") {
    return task.review_status === "done";
  }
  return false;
}

function normalizeRoadmap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return {
    schema_version: 1,
    slug: value.slug,
    title: value.title,
    active_phase_id: value.active_phase_id ?? null,
    active_task_id: value.active_task_id ?? null,
    statuses: TASK_STATUSES,
    kinds: TASK_KINDS,
    phases: Array.isArray(value.phases) ? value.phases : [],
    follow_ups: Array.isArray(value.follow_ups) ? value.follow_ups : [],
    updated_at: value.updated_at ?? nowIso(),
  };
}
