import fs from "node:fs";
import path from "node:path";

import { ensureDir, epicRoot, nowIso, readJson, requireFlag, resolveRoot, roadmapStatePath, runtimeStatePath, writeJson } from "./common.mjs";
import { HOLD_KINDS, readHumanQueue } from "./human-queue.mjs";
import { followUpId, patchTrackerText, scanTracker } from "./tracker-file.mjs";

export const TASK_STATUSES = ["todo", "doing", "need-review", "blocked", "on-hold", "partially-satisfied", "deferred", "reset-required", "done"];
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
            title: "Capture problem framing, desired outcome, scope, non-scope, constraints, risks, and initial open questions.",
            kind: "documentation-only",
            status: "todo",
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

// tracker.md is the source of truth: when it exists, the model is re-read from it on every call
// and roadmap-state.json is only a cache that keeps the explicitly chosen active ids.
export function ensureRoadmapState(projectRoot, slug, { title } = {}) {
  const filePath = roadmapStatePath(projectRoot, slug);
  const cached = normalizeRoadmap(readJson(filePath, null));
  const imported = importRoadmapFromTracker(projectRoot, slug, { title: title || cached?.title });

  if (!imported) {
    if (cached) {
      return cached;
    }
    const initial = createInitialRoadmapState({ slug, title: title || slug });
    writeRoadmapState(projectRoot, slug, initial);
    return initial;
  }

  for (const key of ["active_phase_id", "active_task_id"]) {
    const cachedId = cached?.[key];
    const exists = key === "active_phase_id" ? findPhase(imported, cachedId) : findTask(imported, cachedId);
    if (cachedId && exists) {
      imported[key] = cachedId;
    }
  }
  if (!cached) {
    writeRoadmapState(projectRoot, slug, imported);
  }
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
  assertStatus(status);
  const hold = readHoldFlags(root, slug, status, flags);
  const roadmap = ensureRoadmapState(root, slug);
  const task = requireTask(roadmap, taskId);
  task.status = status;
  task.hold = hold;
  if (status === "doing") {
    roadmap.active_task_id = task.id;
    const phase = findTaskPhase(roadmap, task.id);
    if (phase) {
      phase.status = "doing";
      roadmap.active_phase_id = phase.id;
    }
  }
  finalizeRoadmapMutation(root, slug, roadmap);
  console.log(`Task ${task.id} status: ${status}${hold ? ` (Hold: ${hold.kind} ${hold.item})` : ""}`);
}

// on-hold requires a hold kind and an open human-queue item; every other status clears the hold.
function readHoldFlags(root, slug, status, flags) {
  const kind = typeof flags["hold-kind"] === "string" ? flags["hold-kind"].trim() : null;
  const item = typeof flags["hold-item"] === "string" ? flags["hold-item"].trim().toUpperCase() : null;

  if (status !== "on-hold") {
    if (kind || item) {
      throw new Error("--hold-kind and --hold-item are only valid with --status on-hold.");
    }
    return null;
  }
  if (!kind || !item) {
    throw new Error("--status on-hold requires both --hold-kind <kind> and --hold-item H<n>.");
  }
  if (!HOLD_KINDS.includes(kind)) {
    throw new Error(`Invalid --hold-kind "${kind}". Expected one of: ${HOLD_KINDS.join(", ")}.`);
  }
  const queued = readHumanQueue(root, slug).find((entry) => entry.id === item);
  if (!queued) {
    throw new Error(`Human-queue item not found: ${item}. Add it with human-queue.mjs add first.`);
  }
  if (queued.status !== "open") {
    throw new Error(`Human-queue item ${item} is resolved; a task can only be held on an open item.`);
  }
  return { item, kind };
}

export function startTask(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const taskId = requireFlag(flags, "task-id");
  const roadmap = ensureRoadmapState(root, slug);
  const task = requireTask(roadmap, taskId);
  const phase = findTaskPhase(roadmap, task.id);
  task.status = "doing";
  task.hold = null;
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
  task.hold = null;
  if (roadmap.active_task_id === task.id) {
    roadmap.active_task_id = null;
  }
  finalizeRoadmapMutation(root, slug, roadmap);
  console.log(`Closed task ${task.id}.`);
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
    phase.status = phase.status === "done" ? "done" : "doing";
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
  const id = followUpId(followUps.length + 1, title);
  followUps.push({
    id,
    title,
    kind: flags.kind || "follow-up",
    status: flags.status || "todo",
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
  const trackerPath = path.join(epicRoot(projectRoot, slug), "tracker.md");
  ensureDir(path.dirname(trackerPath));
  fs.writeFileSync(trackerPath, trackerMarkdown(roadmap), "utf8");
}

// Patches tracker.md in place (task lines, phase status lines, Hold lines, appended follow-ups).
// A missing or unparseable tracker is rendered from the model instead.
function finalizeRoadmapMutation(projectRoot, slug, roadmap) {
  roadmap.updated_at = nowIso();
  writeRoadmapState(projectRoot, slug, roadmap);
  const trackerPath = path.join(epicRoot(projectRoot, slug), "tracker.md");
  const scan = fs.existsSync(trackerPath) ? scanTracker(fs.readFileSync(trackerPath, "utf8")) : null;
  if (scan && scan.phases.length > 0) {
    fs.writeFileSync(trackerPath, patchTrackerText(scan, roadmap, formatTask), "utf8");
  } else {
    renderTrackerMarkdown(projectRoot, slug, roadmap);
  }
  syncActiveState(projectRoot, slug, roadmap);
}

function writeRoadmapState(projectRoot, slug, roadmap) {
  writeJson(roadmapStatePath(projectRoot, slug), normalizeRoadmap(roadmap) ?? roadmap);
}

function syncActiveState(projectRoot, slug, roadmap) {
  const activePhase = displayPhase(findPhase(roadmap, roadmap.active_phase_id));
  const activeTask = displayTask(roadmap, findTask(roadmap, roadmap.active_task_id));
  const statePath = path.join(epicRoot(projectRoot, slug), "state-of-epic.md");

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

// Returns null when there is no tracker or it has no phases; callers fall back to cached state.
function importRoadmapFromTracker(projectRoot, slug, { title } = {}) {
  const trackerPath = path.join(epicRoot(projectRoot, slug), "tracker.md");
  if (!fs.existsSync(trackerPath)) {
    return null;
  }

  const scan = scanTracker(fs.readFileSync(trackerPath, "utf8"));
  if (scan.phases.length === 0) {
    return null;
  }

  const allTasks = scan.phases.flatMap((phase) => phase.tasks.map((task) => ({ phase, task })));
  const activeTask = allTasks.find(({ task }) => task.status === "doing");
  return {
    schema_version: 1,
    slug,
    title: title || scan.title || slug,
    active_phase_id: activeTask?.phase.id ?? scan.phases.find((phase) => phase.status === "doing")?.id ?? scan.phases[0].id,
    active_task_id: activeTask?.task.id ?? null,
    statuses: TASK_STATUSES,
    kinds: TASK_KINDS,
    phases: scan.phases,
    follow_ups: scan.follow_ups,
    updated_at: nowIso(),
  };
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
    ...(roadmap.follow_ups?.length ? ["## Follow-Up Tasks", "", ...roadmap.follow_ups.flatMap(formatTask)] : []),
    "",
  ].join("\n");
}

function formatPhase(phase) {
  return [`### ${phaseHeading(phase)}`, "", `- Phase status: ${phase.status ?? "todo"}`, "", ...phase.tasks.flatMap(formatTask)];
}

function formatTask(task) {
  const checked = task.status === "done" ? "x" : " ";
  const lines = [`- [${checked}] Kind: ${task.kind} | Status: ${task.status} | ${task.title}`];
  if (task.hold) lines.push(`  - Hold: ${task.hold.kind} (${task.hold.item})`);
  if (task.outcome) lines.push(`  - Outcome: ${task.outcome}`);
  if (task.surface) lines.push(`  - Surface: ${task.surface}`);
  if (task.acceptance) lines.push(`  - Acceptance: ${task.acceptance}`);
  if (task.docs) lines.push(`  - Docs: ${task.docs}`);
  lines.push("");
  return lines;
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
  if (!phase) {
    return `Follow-up - ${stripFinalPeriod(task.title)}`;
  }
  const taskNumber = taskNumberInPhase(phase, task.id);
  return `Phase ${phaseNumber(phase)} Task ${taskNumber} - ${stripFinalPeriod(task.title)}`;
}

function phaseNumber(phase) {
  return Number(phase?.id?.match(/^phase-(\d+)$/u)?.[1] ?? 0);
}

function taskNumberInPhase(phase, taskId) {
  if (!phase) {
    return "?";
  }
  return phase.tasks.findIndex((item) => item.id === taskId) + 1;
}

function stripFinalPeriod(value) {
  return String(value ?? "").replace(/\.$/u, "");
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
  return (roadmap.follow_ups ?? []).find((item) => item.id === taskId) ?? null;
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

function assertStatus(status) {
  if (!TASK_STATUSES.includes(status)) {
    throw new Error(`Invalid task status "${status}". Expected one of: ${TASK_STATUSES.join(", ")}.`);
  }
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
