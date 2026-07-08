import fs from "node:fs";
import path from "node:path";

import { epicRoot, epicsRoot, nowIso, readJson, readRuntimePlatform, requireFlag, resolveRoot, runtimeStatePath, writeJson } from "./common.mjs";
import {
  appendLoopLog,
  appendPromptLog,
  appendRoleReportIfPresent,
  countLines,
  durationMsBetween,
  executionDir,
  rebuildProgressMarkdown,
  rebuildProgressReport,
} from "./loop-artifacts.mjs";
import {
  ensureClaudeBlockCapMetadata,
  getClaudeBlockCapProximityRoute,
  incrementClaudeBlockCount,
  isClaudeBlockCapExhausted,
  resetClaudeBlockCountForTurn,
  withClaudeBlockCapMetadata,
} from "./loop-claude-cap.mjs";
import {
  MANAGER_PROMPT_TEMPLATE_PATH,
  TECHLEAD_PROMPT_TEMPLATE_PATH,
  appendClaudeManualContinueNote,
  buildEngineerPrompt,
  buildManagerPrompt,
  buildTechleadPrompt,
  normalizePromptFile,
} from "./loop-prompts.mjs";
import { readRoadmapSummary } from "./roadmap.mjs";

const LOOP_ROLES = ["manager", "techlead", "engineer", "idle"];
const WAITING_FOR_TURN_TRANSITION = "awaiting-transition";

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

  const nextLoop = withClaudeBlockCapMetadata(
    projectRoot,
    {
      ...loop,
      current_role: null,
      active_turn_started_at: null,
      active_turn_stopped_at: null,
      driver_session_id: sessionId,
      iteration: Number.isFinite(loop.iteration) ? loop.iteration : 0,
      last_reason: "implementation-start",
      last_session_id: sessionId,
      last_transition_at: timestamp,
      last_transition_by: "bind-session",
      next_role: "manager",
      prompt_file: null,
      status: "running",
    },
    timestamp,
  );

  writeJson(runtimePath, {
    ...runtime,
    implementation_loop: nextLoop,
    implementation_submode: "manager",
    mode: "implementation",
    updated_at: timestamp,
  });

  appendLoopLog(projectRoot, {
    action: "loop-start",
    phase: runtime.active_phase ?? null,
    task: runtime.active_task ?? null,
    next_role: "manager",
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
    implementation_submode: role === "idle" ? (runtime.implementation_submode ?? "techlead") : role,
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
  if (payload.hook_event_name !== "Stop") {
    return null;
  }

  const slug = binding.epic_slug;
  const timestamp = nowIso();

  const runtimePath = runtimeStatePath(projectRoot, slug);
  let runtime = mergeEpicStateIntoRuntime(projectRoot, slug, normalizeObject(readJson(runtimePath, {})));
  let loop = normalizeObject(runtime.implementation_loop);
  const platform = readRuntimePlatform(projectRoot).platform;

  if (runtime.mode !== "implementation" || loop.driver_session_id !== payload.session_id) {
    return null;
  }

  ({ loop, runtime } = recordTurnStopIfNeeded(projectRoot, slug, runtime, loop, payload, timestamp));
  ({ loop, runtime } = ensureClaudeBlockCapMetadata(projectRoot, slug, runtime, loop, timestamp));

  // A fresh user turn (first Stop, stop_hook_active === false) resets Claude Code's own
  // consecutive Stop-hook block counter. Mirror that so a finite block cap is measured
  // per turn instead of accumulating across turns.
  if (platform === "claude-code" && payload.stop_hook_active !== true) {
    ({ loop, runtime } = resetClaudeBlockCountForTurn(projectRoot, slug, runtime, loop, timestamp));
  }

  // Claude Code honours repeated Stop-hook `decision: block` continuations within a single
  // turn up to CLAUDE_CODE_STOP_HOOK_BLOCK_CAP (default 8, `0` = uncapped). `stop_hook_active`
  // is informational, not a hard gate, so the loop keeps chaining roles automatically and
  // only pauses when a finite cap is actually exhausted.
  if (platform === "claude-code" && isClaudeBlockCapExhausted(loop)) {
    appendLoopLog(projectRoot, {
      action: "skip",
      manual_continue_required: true,
      next_role: loop.next_role ?? null,
      reason: "claude-stop-hook-block-cap",
      session_id: payload.session_id ?? null,
      slug,
      timestamp,
    });
    return null;
  }

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

  const capProximityRoute = platform === "claude-code" ? getClaudeBlockCapProximityRoute(loop, timestamp) : null;
  const role = capProximityRoute ? "manager" : loop.next_role;
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

  if (!["manager", "techlead", "engineer"].includes(role)) {
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
  const prompt =
    role === "manager"
      ? buildManagerPrompt(slug, iteration, capProximityRoute?.reason ?? loop.last_reason ?? null)
      : role === "techlead"
        ? buildTechleadPrompt(slug, iteration)
        : buildEngineerPrompt(projectRoot, loop, iteration);
  // Only the final housekeeping turn before a finite-cap pause needs the manual-continue
  // note. With an uncapped run (CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0) roles chain automatically,
  // so appending it to every prompt would misinform the agent.
  const platformPrompt = platform === "claude-code" && capProximityRoute ? appendClaudeManualContinueNote(prompt) : prompt;
  const promptFile = role === "manager" ? MANAGER_PROMPT_TEMPLATE_PATH : role === "engineer" ? (loop.prompt_file ?? null) : TECHLEAD_PROMPT_TEMPLATE_PATH;
  const followingRole = role === "engineer" ? "techlead" : role === "manager" ? "techlead" : WAITING_FOR_TURN_TRANSITION;

  const nextLoop = incrementClaudeBlockCount(
    {
      ...loop,
      active_turn_started_at: timestamp,
      active_turn_stopped_at: null,
      current_role: role,
      iteration,
      last_continuation_at: timestamp,
      last_reason: capProximityRoute?.reason ?? loop.last_reason ?? null,
      last_session_id: payload.session_id ?? null,
      next_role: followingRole,
      status: "running",
    },
    platform,
    timestamp,
    capProximityRoute,
  );

  writeJson(runtimePath, {
    ...runtime,
    implementation_loop: nextLoop,
    implementation_submode: role,
    updated_at: timestamp,
  });

  appendLoopLog(projectRoot, {
    action: "turn-start",
    iteration,
    next_role: followingRole,
    phase: runtime.active_phase ?? null,
    prompt_file: promptFile,
    reason: capProximityRoute?.reason ?? null,
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
    prompt: platformPrompt,
    prompt_file: promptFile,
    role,
    session_id: payload.session_id ?? null,
    slug,
    timestamp,
    turn_id: payload.turn_id ?? null,
  });

  return {
    decision: "block",
    reason: platformPrompt,
  };
}

export function markInterruptedTurnIfNeeded(projectRoot, payload, binding) {
  if (payload.hook_event_name !== "UserPromptSubmit") {
    return false;
  }

  const slug = binding.epic_slug;
  const timestamp = nowIso();
  const runtimePath = runtimeStatePath(projectRoot, slug);
  const runtime = mergeEpicStateIntoRuntime(projectRoot, slug, normalizeObject(readJson(runtimePath, {})));
  const loop = normalizeObject(runtime.implementation_loop);

  if (runtime.mode !== "implementation" || loop.driver_session_id !== payload.session_id) {
    return false;
  }

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

function mergeEpicStateIntoRuntime(projectRoot, slug, runtime) {
  const summary = readRoadmapStateSummary(projectRoot, slug) ?? readEpicStateSummary(projectRoot, slug);

  return {
    ...runtime,
    ...(summary.active_phase !== undefined ? { active_phase: summary.active_phase } : {}),
    ...(summary.active_task !== undefined ? { active_task: summary.active_task } : {}),
  };
}

function readEpicStateSummary(projectRoot, slug) {
  const statePath = path.join(epicRoot(projectRoot, slug), "state-of-epic.md");
  if (!fs.existsSync(statePath)) {
    return {};
  }

  const text = fs.readFileSync(statePath, "utf8");
  return {
    active_phase: readStateLine(text, "Active phase"),
    active_task: readStateLine(text, "Active task"),
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

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function hasOpenTurn(loop) {
  return Boolean(loop.current_role && loop.active_turn_started_at && !loop.active_turn_stopped_at && loop.status === "running");
}

function recordTurnStopIfNeeded(projectRoot, slug, runtime, loop, payload, timestamp) {
  if (!loop.current_role || !loop.active_turn_started_at || loop.active_turn_stopped_at) {
    return { loop, runtime };
  }

  const durationMs = durationMsBetween(loop.active_turn_started_at, timestamp);
  const engineerReport = loop.current_role === "engineer" ? appendRoleReportIfPresent(projectRoot, slug, loop, payload, timestamp, "engineer") : null;
  const managerReport = loop.current_role === "manager" ? appendRoleReportIfPresent(projectRoot, slug, loop, payload, timestamp, "manager") : null;
  const stoppedLoop = {
    ...loop,
    active_turn_stopped_at: timestamp,
    last_engineer_report_at: engineerReport?.timestamp ?? loop.last_engineer_report_at ?? null,
    last_engineer_report_path: engineerReport?.latest_report_path ?? loop.last_engineer_report_path ?? null,
    last_manager_report_at: managerReport?.timestamp ?? loop.last_manager_report_at ?? null,
    last_manager_report_path: managerReport?.latest_report_path ?? loop.last_manager_report_path ?? null,
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
