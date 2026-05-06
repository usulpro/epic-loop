import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureDir, epicsRoot, nowIso, readJson, requireFlag, resolveRoot, writeJson } from "./common.mjs";

const LOOP_ROLES = ["techlead", "engineer", "idle"];
const WAITING_FOR_TURN_TRANSITION = "awaiting-transition";
const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.dirname(path.dirname(LIB_DIR));
const TECHLEAD_PROMPT_TEMPLATE_PATH = path.join(SKILL_DIR, "templates", "implementation-techlead-prompt.md");

export function startImplementationLoop(projectRoot, { sessionId, slug }) {
  const timestamp = nowIso();
  const runtimePath = runtimeStatePath(projectRoot, slug);
  const runtime = normalizeObject(readJson(runtimePath, {}));
  const loop = normalizeObject(runtime.implementation_loop);

  writeJson(runtimePath, {
    ...runtime,
    implementation_loop: {
      ...loop,
      current_role: null,
      active_turn_started_at: null,
      active_turn_stopped_at: null,
      iteration: Number.isFinite(loop.iteration) ? loop.iteration : 0,
      last_reason: "implementation-start",
      last_session_id: sessionId,
      last_transition_at: timestamp,
      last_transition_by: "bind-session",
      next_role: "techlead",
      prompt_file: null,
      status: "running",
    },
    implementation_submode: "techlead",
    mode: "implementation",
    updated_at: timestamp,
  });

  appendLoopLog(projectRoot, {
    action: "loop-start",
    phase: runtime.active_phase ?? null,
    task: runtime.active_task ?? null,
    next_role: "techlead",
    session_id: sessionId,
    slug,
    timestamp,
  });
}

export function setNextRole(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const role = requireFlag(flags, "role");
  const reason = typeof flags.reason === "string" && flags.reason.trim() ? flags.reason.trim() : null;
  const promptFile = normalizePromptFile(root, slug, flags["prompt-file"]);

  if (!LOOP_ROLES.includes(role)) {
    throw new Error(`Invalid --role "${role}". Expected one of: ${LOOP_ROLES.join(", ")}.`);
  }

  if (role === "engineer" && !promptFile) {
    throw new Error("Missing --prompt-file for --role engineer.");
  }

  if (promptFile && !fs.existsSync(path.resolve(root, promptFile))) {
    throw new Error(`Prompt file not found: ${promptFile}`);
  }

  const timestamp = nowIso();
  const runtimePath = runtimeStatePath(root, slug);
  const runtime = normalizeObject(readJson(runtimePath, {}));
  const loop = normalizeObject(runtime.implementation_loop);
  const status = role === "idle" ? "idle" : "running";

  writeJson(runtimePath, {
    ...runtime,
    implementation_loop: {
      ...loop,
      last_reason: reason,
      last_transition_at: timestamp,
      last_transition_by: "set-next-role",
      next_role: role,
      prompt_file: promptFile,
      status,
    },
    implementation_submode: role === "idle" ? runtime.implementation_submode ?? "techlead" : role,
    updated_at: timestamp,
  });

  appendLoopLog(root, {
    action: "role-command",
    command: "set-next-role",
    current_iteration: Number.isFinite(loop.iteration) ? loop.iteration : null,
    current_role: loop.current_role ?? null,
    phase: runtime.active_phase ?? null,
    task: runtime.active_task ?? null,
    next_role: role,
    prompt_file: promptFile,
    reason,
    slug,
    timestamp,
  });

  console.log(`Next implementation role for ${slug}: ${role}`);
  if (promptFile) {
    console.log(`Prompt file: ${promptFile}`);
  }
}

export function maybeBuildImplementationContinuation(projectRoot, payload, binding) {
  if (payload.hook_event_name !== "Stop" || binding.mode !== "implementation") {
    return null;
  }

  const slug = binding.epic_slug;
  const timestamp = nowIso();

  if (payload.stop_hook_active === true) {
    appendLoopLog(projectRoot, {
      action: "skip",
      reason: "stop-hook-active",
      session_id: payload.session_id ?? null,
      slug,
      timestamp,
    });
    return null;
  }

  const runtimePath = runtimeStatePath(projectRoot, slug);
  let runtime = normalizeObject(readJson(runtimePath, {}));
  let loop = normalizeObject(runtime.implementation_loop);

  ({ loop, runtime } = recordTurnStopIfNeeded(projectRoot, slug, runtime, loop, payload, timestamp));

  if (loop.status !== "running") {
    appendLoopLog(projectRoot, {
      action: "skip",
      reason: "loop-not-running",
      session_id: payload.session_id ?? null,
      slug,
      status: loop.status ?? null,
      timestamp,
    });
    return null;
  }

  const role = loop.next_role;
  if (role === WAITING_FOR_TURN_TRANSITION) {
    appendLoopLog(projectRoot, {
      action: "skip",
      reason: "next-role-not-set",
      session_id: payload.session_id ?? null,
      slug,
      timestamp,
    });
    return null;
  }

  if (role === "idle" || !role) {
    appendLoopLog(projectRoot, {
      action: "skip",
      next_role: role ?? null,
      reason: "no-continuation-role",
      session_id: payload.session_id ?? null,
      slug,
      timestamp,
    });
    return null;
  }

  if (!["techlead", "engineer"].includes(role)) {
    appendLoopLog(projectRoot, {
      action: "skip",
      next_role: role,
      reason: "unsupported-role",
      session_id: payload.session_id ?? null,
      slug,
      timestamp,
    });
    return null;
  }

  const iteration = Number.isFinite(loop.iteration) ? loop.iteration + 1 : 1;
  const prompt = role === "techlead" ? buildTechleadPrompt(slug, iteration) : buildEngineerPrompt(projectRoot, slug, loop, iteration);
  const promptFile = role === "engineer" ? loop.prompt_file ?? null : TECHLEAD_PROMPT_TEMPLATE_PATH;

  writeJson(runtimePath, {
    ...runtime,
    implementation_loop: {
      ...loop,
      active_turn_started_at: timestamp,
      active_turn_stopped_at: null,
      current_role: role,
      iteration,
      last_continuation_at: timestamp,
      last_session_id: payload.session_id ?? null,
      next_role: WAITING_FOR_TURN_TRANSITION,
      status: "running",
    },
    implementation_submode: role,
    updated_at: timestamp,
  });

  appendLoopLog(projectRoot, {
    action: "turn-start",
    iteration,
    next_role: WAITING_FOR_TURN_TRANSITION,
    phase: runtime.active_phase ?? null,
    prompt_file: promptFile,
    role,
    session_id: payload.session_id ?? null,
    slug,
    task: runtime.active_task ?? null,
    timestamp,
    turn_id: payload.turn_id ?? null,
  });

  appendPromptLog(projectRoot, {
    iteration,
    prompt,
    prompt_file: promptFile,
    role,
    session_id: payload.session_id ?? null,
    slug,
    timestamp,
    turn_id: payload.turn_id ?? null,
  });

  return {
    decision: "block",
    reason: prompt,
  };
}

export function readImplementationLoops(projectRoot) {
  const root = epicsRoot(projectRoot);

  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const slug = entry.name;
      const runtime = normalizeObject(readJson(runtimeStatePath(projectRoot, slug), {}));
      const executionPath = executionDir(projectRoot, slug);
      return {
        implementation_loop: runtime.implementation_loop ?? null,
        mode: runtime.mode ?? null,
        progress_events: countLines(path.join(executionPath, "progress-log.jsonl")),
        progress_log_path: path.join(executionPath, "progress-log.jsonl"),
        progress_report_path: path.join(executionPath, "progress-report.md"),
        prompt_entries: countLines(path.join(executionPath, "prompt-log.jsonl")),
        prompt_log_path: path.join(executionPath, "prompt-log.md"),
        slug,
        updated_at: runtime.updated_at ?? null,
      };
    });
}

function buildTechleadPrompt(slug, iteration) {
  const promptPath = `.epic-loop/epics/${slug}/execution/current-engineer-prompt.md`;

  return renderTemplate(fs.readFileSync(TECHLEAD_PROMPT_TEMPLATE_PATH, "utf8"), {
    EngineerPromptPath: promptPath,
    EpicSlug: slug,
    Iteration: String(iteration),
  });
}

function buildEngineerPrompt(projectRoot, slug, loop, iteration) {
  const promptFile = loop.prompt_file;
  const absolutePromptPath = promptFile ? path.resolve(projectRoot, promptFile) : null;
  const promptText = absolutePromptPath && fs.existsSync(absolutePromptPath) ? fs.readFileSync(absolutePromptPath, "utf8").trim() : "";

  return [
    `[$epic-loop] Implementation loop: engineer turn ${iteration} for \`${slug}\`.`,
    "",
    "Act as engineer only. Execute the techlead brief below without widening the task.",
    "",
    promptText ? "## Techlead Brief" : "## Techlead Brief Missing",
    "",
    promptText || "No engineer prompt file was found. Stop and return control to techlead.",
    "",
    "Engineer responsibilities:",
    "- implement only the requested slice",
    "- follow existing project patterns",
    "- run the verification requested by the brief",
    "- update task-level epic artifacts with facts, not optimism",
    "- record blockers or mismatches instead of silently redesigning the task",
    "",
    "At the end, return control to techlead by running:",
    "",
    `node .agents/skills/epic-loop/scripts/set-next-role.mjs --slug "${slug}" --role techlead --reason "engineer turn complete"`,
    "",
    "Then report the engineering result briefly and stop.",
  ].join("\n");
}

function normalizePromptFile(root, slug, value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const relative = value.trim();
  if (path.isAbsolute(relative)) {
    return path.relative(root, relative);
  }

  const normalized = path.normalize(relative);
  if (normalized.startsWith("..")) {
    throw new Error(`Prompt file must stay inside the project: ${relative}`);
  }

  if (!normalized.startsWith(`.epic-loop${path.sep}epics${path.sep}${slug}${path.sep}`) && !normalized.startsWith(`.epic-loop/epics/${slug}/`)) {
    throw new Error(`Prompt file must be inside .epic-loop/epics/${slug}/.`);
  }

  return normalized;
}

function runtimeStatePath(projectRoot, slug) {
  return path.join(epicsRoot(projectRoot), slug, "runtime-state.json");
}

function appendLoopLog(projectRoot, entry) {
  const slug = entry.slug;
  if (!slug) {
    return;
  }

  const logPath = path.join(executionDir(projectRoot, slug), "progress-log.jsonl");
  appendJsonLine(logPath, entry);
  rebuildProgressReport(projectRoot, slug);
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function renderTemplate(template, values) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`-<<*{{${key}}}*>>-`, value), template).trim();
}

function recordTurnStopIfNeeded(projectRoot, slug, runtime, loop, payload, timestamp) {
  if (!loop.current_role || !loop.active_turn_started_at || loop.active_turn_stopped_at) {
    return { loop, runtime };
  }

  const durationMs = durationMsBetween(loop.active_turn_started_at, timestamp);
  const stoppedLoop = {
    ...loop,
    active_turn_stopped_at: timestamp,
    last_stop_session_id: payload.session_id ?? null,
    last_stop_turn_id: payload.turn_id ?? null,
  };
  const nextRuntime = {
    ...runtime,
    implementation_loop: stoppedLoop,
    updated_at: timestamp,
  };

  writeJson(runtimeStatePath(projectRoot, slug), nextRuntime);
  appendLoopLog(projectRoot, {
    action: "turn-stop",
    duration_ms: durationMs,
    ended_at: timestamp,
    iteration: Number.isFinite(loop.iteration) ? loop.iteration : null,
    phase: runtime.active_phase ?? null,
    role: loop.current_role,
    session_id: payload.session_id ?? null,
    slug,
    started_at: loop.active_turn_started_at,
    task: runtime.active_task ?? null,
    timestamp,
    turn_id: payload.turn_id ?? null,
  });

  return { loop: stoppedLoop, runtime: nextRuntime };
}

function appendPromptLog(projectRoot, entry) {
  const promptLogJsonlPath = path.join(executionDir(projectRoot, entry.slug), "prompt-log.jsonl");
  const promptLogMarkdownPath = path.join(executionDir(projectRoot, entry.slug), "prompt-log.md");
  appendJsonLine(promptLogJsonlPath, entry);
  appendPromptMarkdown(promptLogMarkdownPath, entry);
}

function appendPromptMarkdown(filePath, entry) {
  ensureMarkdownFile(filePath, "# Implementation Prompt Log\n");
  fs.appendFileSync(
    filePath,
    [
      "",
      `## ${entry.timestamp} | turn ${entry.iteration} | ${entry.role}`,
      "",
      `- Session: \`${entry.session_id ?? "unknown"}\``,
      `- Turn: \`${entry.turn_id ?? "unknown"}\``,
      `- Prompt source: \`${entry.prompt_file ?? "inline"}\``,
      "",
      "````text",
      entry.prompt,
      "````",
      "",
    ].join("\n"),
    "utf8",
  );
}

function rebuildProgressReport(projectRoot, slug) {
  const executionPath = executionDir(projectRoot, slug);
  const events = readJsonLines(path.join(executionPath, "progress-log.jsonl"));
  const promptEvents = readJsonLines(path.join(executionPath, "prompt-log.jsonl"));
  const reportPath = path.join(executionPath, "progress-report.md");
  const firstTimestamp = firstEventTimestamp(events);
  const lastTimestamp = lastEventTimestamp(events);
  const completedTurns = events.filter((event) => event.action === "turn-stop");
  const roleCommands = events.filter((event) => event.action === "role-command");
  const activeMs = sum(completedTurns.map((event) => Number(event.duration_ms) || 0));
  const elapsedMs = firstTimestamp && lastTimestamp ? Math.max(0, Date.parse(lastTimestamp) - Date.parse(firstTimestamp)) : 0;
  const idleMs = Math.max(0, elapsedMs - activeMs);
  const byRole = groupDurations(completedTurns, (event) => event.role ?? "unknown");
  const byPhase = groupNestedDurations(completedTurns);
  const openTurns = collectOpenTurns(events);
  const generatedAt = nowIso();

  writeText(
    reportPath,
    [
      "# Implementation Progress Report",
      "",
      `Generated: ${generatedAt}`,
      "",
      "## Work Window",
      "",
      `- First event: ${firstTimestamp ?? "n/a"}`,
      `- Last event: ${lastTimestamp ?? "n/a"}`,
      `- Elapsed wall time: ${formatDuration(elapsedMs)}`,
      `- Active turn time: ${formatDuration(activeMs)}`,
      `- Observed idle or paused time: ${formatDuration(idleMs)}`,
      `- Completed turns: ${completedTurns.length}`,
      `- Prompt entries: ${promptEvents.length}`,
      "",
      "## Time By Role",
      "",
      ...formatRoleDurations(byRole),
      "",
      "## Phases And Tasks",
      "",
      ...formatPhaseDurations(byPhase),
      "",
      "## Role Commands",
      "",
      ...formatRoleCommands(roleCommands),
      "",
      "## Open Turns",
      "",
      ...formatOpenTurns(openTurns),
      "",
    ].join("\n"),
  );
}

function formatRoleDurations(byRole) {
  const entries = Object.entries(byRole);
  if (entries.length === 0) {
    return ["- No completed turns yet."];
  }

  return entries.map(([role, item]) => `- ${role}: ${formatDuration(item.durationMs)} across ${item.turns} turn${item.turns === 1 ? "" : "s"}`);
}

function formatPhaseDurations(byPhase) {
  const lines = [];
  const entries = Object.entries(byPhase);

  if (entries.length === 0) {
    return ["- No completed turns yet."];
  }

  for (const [phase, phaseData] of entries) {
    lines.push(`### ${phase}`);
    lines.push("");
    lines.push(`- Active time: ${formatDuration(phaseData.durationMs)}`);
    lines.push(`- Turns: ${phaseData.turns}`);
    lines.push("");

    for (const [task, taskData] of Object.entries(phaseData.tasks)) {
      lines.push(`#### ${task}`);
      lines.push("");
      lines.push(`- Active time: ${formatDuration(taskData.durationMs)}`);
      lines.push(`- Turns: ${taskData.turns}`);
      for (const turn of taskData.turnsList) {
        lines.push(
          `- Turn ${turn.iteration ?? "?"} | ${turn.role ?? "unknown"} | ${turn.session_id ?? "unknown"} | ${turn.started_at ?? "?"} -> ${turn.ended_at ?? "?"} | ${formatDuration(Number(turn.duration_ms) || 0)}`,
        );
      }
      lines.push("");
    }
  }

  return lines;
}

function formatRoleCommands(commands) {
  if (commands.length === 0) {
    return ["- No role commands recorded yet."];
  }

  return commands.map((command) => {
    const parts = [
      `${command.timestamp}`,
      `current=${command.current_role ?? "unknown"}`,
      `next=${command.next_role ?? "unknown"}`,
      `reason=${command.reason ?? "n/a"}`,
    ];
    if (command.prompt_file) {
      parts.push(`prompt=${command.prompt_file}`);
    }
    return `- ${parts.join(" | ")}`;
  });
}

function formatOpenTurns(openTurns) {
  if (openTurns.length === 0) {
    return ["- No open turns."];
  }

  return openTurns.map((turn) => `- Turn ${turn.iteration ?? "?"} | ${turn.role ?? "unknown"} | started ${turn.timestamp}`);
}

function collectOpenTurns(events) {
  const starts = events.filter((event) => event.action === "turn-start");
  const stoppedKeys = new Set(events.filter((event) => event.action === "turn-stop").map(turnKey));
  return starts.filter((event) => !stoppedKeys.has(turnKey(event)));
}

function groupDurations(events, keyFn) {
  const groups = {};
  for (const event of events) {
    const key = keyFn(event);
    const current = groups[key] ?? { durationMs: 0, turns: 0 };
    current.durationMs += Number(event.duration_ms) || 0;
    current.turns += 1;
    groups[key] = current;
  }
  return groups;
}

function groupNestedDurations(events) {
  const groups = {};

  for (const event of events) {
    const phase = event.phase || "Unassigned phase";
    const task = event.task || "Unassigned task";
    const durationMs = Number(event.duration_ms) || 0;
    const phaseData = groups[phase] ?? { durationMs: 0, tasks: {}, turns: 0 };
    const taskData = phaseData.tasks[task] ?? { durationMs: 0, turns: 0, turnsList: [] };

    phaseData.durationMs += durationMs;
    phaseData.turns += 1;
    taskData.durationMs += durationMs;
    taskData.turns += 1;
    taskData.turnsList.push(event);
    phaseData.tasks[task] = taskData;
    groups[phase] = phaseData;
  }

  return groups;
}

function firstEventTimestamp(events) {
  return events.map((event) => event.timestamp).filter(Boolean).sort()[0] ?? null;
}

function lastEventTimestamp(events) {
  return events.map((event) => event.timestamp).filter(Boolean).sort().at(-1) ?? null;
}

function durationMsBetween(start, end) {
  const startMs = Date.parse(start ?? "");
  const endMs = Date.parse(end ?? "");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }
  return Math.max(0, endMs - startMs);
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0s";
  }

  const seconds = Math.round(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const restSeconds = seconds % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (restSeconds > 0 || parts.length === 0) {
    parts.push(`${restSeconds}s`);
  }

  return parts.join(" ");
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function appendJsonLine(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function ensureMarkdownFile(filePath, header) {
  if (fs.existsSync(filePath)) {
    return;
  }
  writeText(filePath, `${header.trim()}\n`);
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, "utf8");
}

function executionDir(projectRoot, slug) {
  return path.join(epicsRoot(projectRoot), slug, "execution");
}

function sum(values) {
  return values.reduce((acc, value) => acc + value, 0);
}

function turnKey(event) {
  return `${event.iteration ?? "?"}:${event.role ?? "unknown"}`;
}

function countLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return 0;
  }

  return fs.readFileSync(filePath, "utf8").split(/\r?\n/u).filter(Boolean).length;
}
