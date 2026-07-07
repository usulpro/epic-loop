import fs from "node:fs";
import path from "node:path";

import { ensureDir, epicRuntimeRoot, nowIso, readRuntimePlatform } from "./common.mjs";

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

export function appendLoopLog(projectRoot, entry) {
  const slug = entry.slug;
  if (!slug) {
    return;
  }

  const executionPath = executionDir(projectRoot, slug);
  appendJsonLine(path.join(executionPath, "progress-log.jsonl"), entry);
  appendProgressMarkdown(path.join(executionPath, "progress-log.md"), entry);
  rebuildProgressReport(projectRoot, slug);
}

export function appendPromptLog(projectRoot, entry) {
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

export function appendRoleReportIfPresent(projectRoot, slug, loop, payload, timestamp, reportRole) {
  const message = readAssistantReportMessage(projectRoot, payload);
  if (!message) {
    return null;
  }

  const executionPath = executionDir(projectRoot, slug);
  const latestReportPath = path.join(executionPath, `latest-${reportRole}-report.md`);
  const report = {
    iteration: Number.isFinite(loop.iteration) ? loop.iteration : null,
    message,
    role: reportRole,
    session_id: payload.session_id ?? null,
    slug,
    timestamp,
    turn_id: payload.turn_id ?? null,
  };

  appendJsonLine(path.join(executionPath, `${reportRole}-reports.jsonl`), report);
  appendRoleReportMarkdown(path.join(executionPath, `${reportRole}-reports.md`), reportRole, report);
  writeText(latestReportPath, formatEngineerReport(report));

  return {
    latest_report_path: path.relative(projectRoot, latestReportPath),
    timestamp,
  };
}

function readAssistantReportMessage(projectRoot, payload) {
  const platform = readRuntimePlatform(projectRoot).platform;

  if (platform === "claude-code") {
    const payloadMessage = typeof payload.last_assistant_message === "string" ? payload.last_assistant_message.trim() : "";
    return payloadMessage || readLatestClaudeAssistantMessage(payload.transcript_path);
  }

  if (platform === "codex") {
    return typeof payload.last_assistant_message === "string" ? payload.last_assistant_message.trim() : "";
  }

  return "";
}

function readLatestClaudeAssistantMessage(transcriptPath) {
  if (typeof transcriptPath !== "string" || !transcriptPath) {
    return "";
  }

  let content;
  try {
    content = fs.readFileSync(transcriptPath, "utf8");
  } catch {
    return "";
  }

  let latestMessage = "";
  for (const line of content.split(/\r?\n/u)) {
    if (!line.trim()) {
      continue;
    }

    const item = readJsonLine(line);
    if (!item || !isAssistantTranscriptItem(item)) {
      continue;
    }

    const message = extractTranscriptText(item.message?.content ?? item.content ?? item.text);
    if (message) {
      latestMessage = message;
    }
  }

  return latestMessage;
}

function isAssistantTranscriptItem(item) {
  return item?.role === "assistant" || item?.type === "assistant" || item?.message?.role === "assistant" || item?.message?.type === "assistant";
}

function extractTranscriptText(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => extractTranscriptText(typeof item === "string" ? item : (item?.text ?? item?.content)))
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  if (value && typeof value === "object") {
    return extractTranscriptText(value.text ?? value.content);
  }

  return "";
}

function appendRoleReportMarkdown(filePath, reportRole, report) {
  ensureMarkdownFile(filePath, `# ${capitalizeRole(reportRole)} Reports\n`);
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

function capitalizeRole(role) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function appendProgressMarkdown(filePath, entry) {
  ensureMarkdownFile(filePath, "# Implementation Progress Log\n");
  fs.appendFileSync(
    filePath,
    ["", `## ${entry.timestamp ?? nowIso()} | ${entry.action ?? "event"}`, "", progressSummary(entry), "", ...formatProgressDetails(entry), ""].join("\n"),
    "utf8",
  );
}

export function rebuildProgressMarkdown(projectRoot, slug) {
  const executionPath = executionDir(projectRoot, slug);
  const markdownPath = path.join(executionPath, "progress-log.md");
  const events = readJsonLines(path.join(executionPath, "progress-log.jsonl"));

  writeText(markdownPath, "# Implementation Progress Log\n");
  for (const event of events) {
    appendProgressMarkdown(markdownPath, event);
  }
}

export function rebuildProgressReport(projectRoot, slug) {
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
    const parts = [`${command.timestamp}`, `current=${command.current_role ?? "unknown"}`, `next=${command.next_role ?? "unknown"}`, `reason=${command.reason ?? "n/a"}`];
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
    return value ? `\`${value}\`` : '`""`';
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
  return (
    events
      .map((event) => event.timestamp)
      .filter(Boolean)
      .sort()[0] ?? null
  );
}

function lastEventTimestamp(events) {
  return (
    events
      .map((event) => event.timestamp)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null
  );
}

export function durationMsBetween(start, end) {
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

function readJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
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

export function executionDir(projectRoot, slug) {
  return epicRuntimeRoot(projectRoot, slug);
}

function sum(values) {
  return values.reduce((acc, value) => acc + value, 0);
}

function turnKey(event) {
  return `${event.iteration ?? "?"}:${event.role ?? "unknown"}`;
}

export function countLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return 0;
  }

  return fs.readFileSync(filePath, "utf8").split(/\r?\n/u).filter(Boolean).length;
}
