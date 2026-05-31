import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureDir, epicRuntimeRoot, epicsRoot, nowIso, readJson, readLastAssistantMessage, requireFlag, resolveRoot, runtimeStatePath, writeJson } from "./common.mjs";
import { readRoadmapSummary } from "./roadmap.mjs";

const LOOP_ROLES = ["techlead", "engineer", "idle"];
const WAITING_FOR_TURN_TRANSITION = "awaiting-transition";
const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.dirname(path.dirname(LIB_DIR));
const TECHLEAD_PROMPT_TEMPLATE_PATH = path.join(SKILL_DIR, "templates", "implementation-techlead-prompt.md");
const LATEST_ENGINEER_REPORT_RELATIVE_PATH = ".runtime/latest-engineer-report.md";
const PROGRESS_FIELD_LABELS = {
  current_iteration: "Current iteration",
  current_role: "Current role",
  duration_ms: "Duration",
  ended_at: "Ended at",
  last_reason: "Last reason",
  next_role: "Next role",
  phase: "Phase",
  prompt_file: "Prompt file",
  reason: "Reason",
  role: "Role",
  session_id: "Session",
  slug: "Slug",
  started_at: "Started at",
  status: "Status",
  stop_hook_active: "Stop hook active",
  task: "Task",
  turn_id: "Turn",
};

export function startImplementationLoop(projectRoot, { sessionId, slug }) {
  const timestamp = nowIso();
  const runtimePath = runtimeStatePath(projectRoot, slug);
  const runtime = mergeEpicStateIntoRuntime(projectRoot, slug, normalizeObject(readJson(runtimePath, {})));
  const loop = normalizeObject(runtime.implementation_loop);

  if (hasOpenTurn(loop)) {
    recordTurnInterrupted(projectRoot, slug, runtime, loop, {
      durationMs: null,
      reason: "implementation-loop-restarted-with-open-turn",
      sessionId: loop.last_session_id ?? sessionId,
      timestamp,
      turnId: loop.last_stop_turn_id ?? null,
    });
  }

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
  const runtime = mergeEpicStateIntoRuntime(root, slug, normalizeObject(readJson(runtimePath, {})));
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

export function maybeBuildImplementationContinuation(projectRoot, payload, binding, platform = "codex") {
  if (payload.hook_event_name !== "Stop" || binding.mode !== "implementation") {
    return null;
  }

  const slug = binding.epic_slug;
  const timestamp = nowIso();

  const runtimePath = runtimeStatePath(projectRoot, slug);
  let runtime = mergeEpicStateIntoRuntime(projectRoot, slug, normalizeObject(readJson(runtimePath, {})));
  let loop = normalizeObject(runtime.implementation_loop);

  ({ loop, runtime } = recordTurnStopIfNeeded(projectRoot, slug, runtime, loop, payload, timestamp, platform));

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
  const followingRole = role === "engineer" ? "techlead" : WAITING_FOR_TURN_TRANSITION;

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
      next_role: followingRole,
      status: "running",
    },
    implementation_submode: role,
    updated_at: timestamp,
  });

  appendLoopLog(projectRoot, {
    action: "turn-start",
    iteration,
    next_role: followingRole,
    phase: runtime.active_phase ?? null,
    prompt_file: promptFile,
    role,
    session_id: payload.session_id ?? null,
    slug,
    stop_hook_active: payload.stop_hook_active === true,
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

export function markInterruptedTurnIfNeeded(projectRoot, payload, binding) {
  if (payload.hook_event_name !== "UserPromptSubmit" || binding.mode !== "implementation") {
    return false;
  }

  const slug = binding.epic_slug;
  const timestamp = nowIso();
  const runtimePath = runtimeStatePath(projectRoot, slug);
  const runtime = mergeEpicStateIntoRuntime(projectRoot, slug, normalizeObject(readJson(runtimePath, {})));
  const loop = normalizeObject(runtime.implementation_loop);

  if (!hasOpenTurn(loop)) {
    return false;
  }

  recordTurnInterrupted(projectRoot, slug, runtime, loop, {
    reason: "user-prompt-interrupted-open-turn",
    sessionId: payload.session_id ?? null,
    timestamp,
    turnId: payload.turn_id ?? null,
  });

  return true;
}

export function interruptOpenTurn(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const reason = typeof flags.reason === "string" && flags.reason.trim() ? flags.reason.trim() : "manual-interrupt-open-turn";
  const timestamp = typeof flags.timestamp === "string" && flags.timestamp.trim() ? flags.timestamp.trim() : nowIso();
  const runtimePath = runtimeStatePath(root, slug);
  const runtime = mergeEpicStateIntoRuntime(root, slug, normalizeObject(readJson(runtimePath, {})));
  const loop = normalizeObject(runtime.implementation_loop);

  if (!hasOpenTurn(loop)) {
    console.log(`No open implementation turn for ${slug}.`);
    return;
  }

  recordTurnInterrupted(root, slug, runtime, loop, {
    durationMs: parseInterruptDuration(flags),
    reason,
    sessionId: flags["session-id"] ?? loop.last_session_id ?? null,
    timestamp,
    turnId: flags["turn-id"] ?? loop.last_stop_turn_id ?? null,
  });

  console.log(`Interrupted open implementation turn for ${slug}.`);
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
        progress_log_markdown_path: path.join(executionPath, "progress-log.md"),
        progress_log_path: path.join(executionPath, "progress-log.jsonl"),
        progress_report_path: path.join(executionPath, "progress-report.md"),
        engineer_reports: countLines(path.join(executionPath, "engineer-reports.jsonl")),
        engineer_reports_path: path.join(executionPath, "engineer-reports.md"),
        latest_engineer_report_path: path.join(executionPath, "latest-engineer-report.md"),
        prompt_entries: countLines(path.join(executionPath, "prompt-log.jsonl")),
        prompt_log_path: path.join(executionPath, "prompt-log.md"),
        slug,
        updated_at: runtime.updated_at ?? null,
      };
    });
}

export function rebuildProgressArtifacts(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");

  rebuildProgressMarkdown(root, slug);
  rebuildProgressReport(root, slug);
  console.log(`Rebuilt implementation progress artifacts for ${slug}.`);
}

function buildTechleadPrompt(slug, iteration) {
  const promptPath = `.epic-loop/epics/${slug}/.runtime/current-engineer-prompt.md`;
  const latestEngineerReportPath = `.epic-loop/epics/${slug}/${LATEST_ENGINEER_REPORT_RELATIVE_PATH}`;

  return renderTemplate(fs.readFileSync(TECHLEAD_PROMPT_TEMPLATE_PATH, "utf8"), {
    EngineerPromptPath: promptPath,
    EpicSlug: slug,
    Iteration: String(iteration),
    LatestEngineerReportPath: latestEngineerReportPath,
  });
}

function buildEngineerPrompt(projectRoot, slug, loop, iteration) {
  const promptFile = loop.prompt_file;
  const absolutePromptPath = promptFile ? path.resolve(projectRoot, promptFile) : null;
  const promptText = absolutePromptPath && fs.existsSync(absolutePromptPath) ? fs.readFileSync(absolutePromptPath, "utf8").trim() : "";

  return [
    `Focused implementation task ${iteration}.`,
    "",
    "Execute the task brief below. Keep the work narrow and do not widen the scope.",
    "",
    promptText ? "## Task Brief" : "## Task Brief Missing",
    "",
    promptText || "No task brief was found. Report that the brief is missing and stop.",
    "",
    "## Report",
    "",
    "When finished, reply with a concise factual report:",
    "",
    "- changed files",
    "- implemented behavior",
    "- verification run and results",
    "- blockers, gaps, or follow-up notes",
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

function mergeEpicStateIntoRuntime(projectRoot, slug, runtime) {
  const summary = readRoadmapStateSummary(projectRoot, slug) ?? readEpicStateSummary(projectRoot, slug);

  return {
    ...runtime,
    ...(summary.active_phase !== undefined ? { active_phase: summary.active_phase } : {}),
    ...(summary.active_task !== undefined ? { active_task: summary.active_task } : {}),
    ...(summary.mode !== undefined ? { mode: summary.mode } : {}),
  };
}

function readEpicStateSummary(projectRoot, slug) {
  const statePath = path.join(epicsRoot(projectRoot), slug, "state-of-epic.md");
  if (!fs.existsSync(statePath)) {
    return {};
  }

  const text = fs.readFileSync(statePath, "utf8");
  return {
    active_phase: readStateLine(text, "Active phase"),
    active_task: readStateLine(text, "Active task"),
    mode: readStateLine(text, "Current mode"),
  };
}

function readRoadmapStateSummary(projectRoot, slug) {
  try {
    return readRoadmapSummary(projectRoot, slug);
  } catch {
    return null;
  }
}

function readStateLine(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = text.match(new RegExp(`^${escaped}:\\s*(.+)$`, "imu"));
  if (!match) {
    return undefined;
  }

  const value = (match[1] ?? "").trim().replace(/^`|`$/gu, "");
  if (!value || /^(none|null|n\/a|tbd)$/iu.test(value)) {
    return null;
  }

  return value;
}

function appendLoopLog(projectRoot, entry) {
  const slug = entry.slug;
  if (!slug) {
    return;
  }

  const executionPath = executionDir(projectRoot, slug);
  appendJsonLine(path.join(executionPath, "progress-log.jsonl"), entry);
  appendProgressMarkdown(path.join(executionPath, "progress-log.md"), entry);
  rebuildProgressReport(projectRoot, slug);
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function hasOpenTurn(loop) {
  return Boolean(loop.current_role && loop.active_turn_started_at && !loop.active_turn_stopped_at && loop.status === "running");
}

function renderTemplate(template, values) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`-<<*{{${key}}}*>>-`, value), template).trim();
}

function recordTurnStopIfNeeded(projectRoot, slug, runtime, loop, payload, timestamp, platform = "codex") {
  if (!loop.current_role || !loop.active_turn_started_at || loop.active_turn_stopped_at) {
    return { loop, runtime };
  }

  const durationMs = durationMsBetween(loop.active_turn_started_at, timestamp);
  const engineerReport = loop.current_role === "engineer" ? appendEngineerReportIfPresent(projectRoot, slug, loop, payload, timestamp, platform) : null;
  const stoppedLoop = {
    ...loop,
    active_turn_stopped_at: timestamp,
    last_engineer_report_at: engineerReport?.timestamp ?? loop.last_engineer_report_at ?? null,
    last_engineer_report_path: engineerReport?.latest_report_path ?? loop.last_engineer_report_path ?? null,
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
    stop_hook_active: payload.stop_hook_active === true,
    task: runtime.active_task ?? null,
    timestamp,
    turn_id: payload.turn_id ?? null,
  });

  return { loop: stoppedLoop, runtime: nextRuntime };
}

function recordTurnInterrupted(projectRoot, slug, runtime, loop, { durationMs, reason, sessionId, timestamp, turnId }) {
  const resolvedDurationMs = durationMs === undefined ? durationMsBetween(loop.active_turn_started_at, timestamp) : durationMs;
  const stoppedLoop = {
    ...loop,
    active_turn_stopped_at: timestamp,
    last_interrupt_session_id: sessionId ?? null,
    last_interrupt_turn_id: turnId ?? null,
    last_reason: reason,
    next_role: "idle",
    status: "interrupted",
  };

  const nextRuntime = {
    ...runtime,
    implementation_loop: stoppedLoop,
    updated_at: timestamp,
  };

  writeJson(runtimeStatePath(projectRoot, slug), nextRuntime);
  appendLoopLog(projectRoot, {
    action: "turn-interrupted",
    duration_ms: resolvedDurationMs,
    ended_at: timestamp,
    iteration: Number.isFinite(loop.iteration) ? loop.iteration : null,
    phase: runtime.active_phase ?? null,
    reason,
    role: loop.current_role,
    session_id: sessionId ?? null,
    slug,
    started_at: loop.active_turn_started_at,
    task: runtime.active_task ?? null,
    timestamp,
    turn_id: turnId ?? null,
  });

  return nextRuntime;
}

function parseInterruptDuration(flags) {
  if (flags["unknown-duration"]) {
    return null;
  }

  if (flags["duration-ms"] === undefined) {
    return undefined;
  }

  const durationMs = Number(flags["duration-ms"]);
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error(`Invalid --duration-ms "${flags["duration-ms"]}".`);
  }

  return durationMs;
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

function appendEngineerReportIfPresent(projectRoot, slug, loop, payload, timestamp, platform = "codex") {
  const message = readLastAssistantMessage(platform, payload);
  if (!message) {
    return null;
  }

  const executionPath = executionDir(projectRoot, slug);
  const latestReportPath = path.join(executionPath, "latest-engineer-report.md");
  const report = {
    iteration: Number.isFinite(loop.iteration) ? loop.iteration : null,
    message,
    role: loop.current_role,
    session_id: payload.session_id ?? null,
    slug,
    timestamp,
    turn_id: payload.turn_id ?? null,
  };

  appendJsonLine(path.join(executionPath, "engineer-reports.jsonl"), report);
  appendEngineerReportMarkdown(path.join(executionPath, "engineer-reports.md"), report);
  writeText(latestReportPath, formatEngineerReport(report));

  return {
    latest_report_path: path.relative(projectRoot, latestReportPath),
    timestamp,
  };
}

function appendEngineerReportMarkdown(filePath, report) {
  ensureMarkdownFile(filePath, "# Engineer Reports\n");
  fs.appendFileSync(filePath, `\n${formatEngineerReport(report)}`, "utf8");
}

function formatEngineerReport(report) {
  return [
    `## ${report.timestamp} | turn ${report.iteration ?? "?"}`,
    "",
    `- Session: \`${report.session_id ?? "unknown"}\``,
    `- Turn: \`${report.turn_id ?? "unknown"}\``,
    "",
    "````text",
    report.message,
    "````",
    "",
  ].join("\n");
}

function appendProgressMarkdown(filePath, entry) {
  ensureMarkdownFile(filePath, "# Implementation Progress Log\n");
  fs.appendFileSync(
    filePath,
    [
      "",
      `## ${entry.timestamp ?? nowIso()} | ${entry.action ?? "event"}`,
      "",
      progressSummary(entry),
      "",
      ...formatProgressDetails(entry),
      "",
    ].join("\n"),
    "utf8",
  );
}

function rebuildProgressMarkdown(projectRoot, slug) {
  const executionPath = executionDir(projectRoot, slug);
  const markdownPath = path.join(executionPath, "progress-log.md");
  const events = readJsonLines(path.join(executionPath, "progress-log.jsonl"));

  writeText(markdownPath, "# Implementation Progress Log\n");
  for (const event of events) {
    appendProgressMarkdown(markdownPath, event);
  }
}

function rebuildProgressReport(projectRoot, slug) {
  const executionPath = executionDir(projectRoot, slug);
  const events = readJsonLines(path.join(executionPath, "progress-log.jsonl"));
  const promptEvents = readJsonLines(path.join(executionPath, "prompt-log.jsonl"));
  const reportPath = path.join(executionPath, "progress-report.md");
  const firstTimestamp = firstEventTimestamp(events);
  const lastTimestamp = lastEventTimestamp(events);
  const completedTurns = events.filter((event) => event.action === "turn-stop");
  const interruptedTurns = events.filter((event) => event.action === "turn-interrupted");
  const endedTurns = [...completedTurns, ...interruptedTurns].sort((a, b) => String(a.timestamp ?? "").localeCompare(String(b.timestamp ?? "")));
  const roleCommands = events.filter((event) => event.action === "role-command");
  const activeMs = sum(endedTurns.map((event) => Number(event.duration_ms) || 0));
  const elapsedMs = firstTimestamp && lastTimestamp ? Math.max(0, Date.parse(lastTimestamp) - Date.parse(firstTimestamp)) : 0;
  const idleMs = Math.max(0, elapsedMs - activeMs);
  const byRole = groupDurations(endedTurns, (event) => event.role ?? "unknown");
  const byPhase = groupNestedDurations(endedTurns);
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
      `- Interrupted turns: ${interruptedTurns.length}`,
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

function progressSummary(entry) {
  switch (entry.action) {
    case "loop-start":
      return `Loop started. Next role: \`${entry.next_role ?? "unknown"}\`.`;
    case "role-command":
      return `Role command set next role to \`${entry.next_role ?? "unknown"}\`${entry.reason ? `: ${entry.reason}.` : "."}`;
    case "turn-start":
      return `Turn ${entry.iteration ?? "?"} started for \`${entry.role ?? "unknown"}\`.`;
    case "turn-stop":
      return `Turn ${entry.iteration ?? "?"} stopped after ${formatDuration(Number(entry.duration_ms) || 0)}.`;
    case "turn-interrupted":
      return `Turn ${entry.iteration ?? "?"} was interrupted after ${formatDuration(Number(entry.duration_ms) || 0)}.`;
    case "skip":
      return `Continuation skipped: ${entry.reason ?? "no reason recorded"}.`;
    default:
      return "Progress event recorded.";
  }
}

function formatProgressDetails(entry) {
  return Object.entries(entry)
    .filter(([key, value]) => key !== "action" && key !== "timestamp" && value !== undefined)
    .map(([key, value]) => `- ${formatFieldName(key)}: ${formatFieldValue(key, value)}`);
}

function formatFieldName(key) {
  if (PROGRESS_FIELD_LABELS[key]) {
    return PROGRESS_FIELD_LABELS[key];
  }

  return key.replace(/_/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function formatFieldValue(key, value) {
  if (value === null) {
    return "`null`";
  }

  if (key === "duration_ms" && typeof value === "number") {
    return `${formatDuration(value)} (${value} ms)`;
  }

  if (typeof value === "string") {
    return value ? `\`${value}\`` : "`\"\"`";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return `\`${String(value)}\``;
  }

  return `\`${JSON.stringify(value)}\``;
}

function collectOpenTurns(events) {
  const starts = events.filter((event) => event.action === "turn-start");
  const endedKeys = new Set(events.filter((event) => event.action === "turn-stop" || event.action === "turn-interrupted").map(turnKey));
  return starts.filter((event) => !endedKeys.has(turnKey(event)));
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
  return epicRuntimeRoot(projectRoot, slug);
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
