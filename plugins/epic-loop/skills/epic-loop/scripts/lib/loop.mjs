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
import { runningBackgroundTaskIds, shouldWaitForBackgroundTasks, waitedMs, waitForBackgroundTasks } from "./loop-background.mjs";
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
  STOP_REVIEW_PROMPT_TEMPLATE_PATH,
  TECHLEAD_PROMPT_TEMPLATE_PATH,
  appendClaudeManualContinueNote,
  buildEngineerPrompt,
  buildManagerPrompt,
  buildStopReviewPrompt,
  buildTechleadPrompt,
  SKILL_DIR,
  normalizePromptFile,
  prependResumeNote,
} from "./loop-prompts.mjs";
import { awaitReviewIfBlocked } from "./loop-gates.mjs";
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
      stop_challenge: null,
      stop_report_iteration: null,
      stop_request: null,
      stop_review_iteration: null,
      stop_rounds: 0,
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

  if (hasOpenTurn(loop) && loop.current_role === "manager" && loop.stop_request && loop.stop_review_iteration === loop.iteration) {
    throw new Error(`This is a stop-review turn: resolve the stop request with ${skillScript("review-stop.mjs")} instead of set-next-role.`);
  }

  // Only a manager stop review ends the loop from inside a role turn (see request-stop.mjs).
  // Outside a turn, idle stays available to tooling.
  if (role === "idle" && hasOpenTurn(loop) && loop.current_role === "techlead") {
    throw new Error(`The techlead cannot set the loop idle. File a stop request with ${skillScript("request-stop.mjs")} --class A|B|C|D|E|F; a manager stop review decides.`);
  }

  if (role === "idle" && hasOpenTurn(loop) && loop.current_role === "manager") {
    throw new Error(
      `A manager housekeeping turn cannot set the loop idle. Only a stop review (${skillScript("review-stop.mjs")}) ends the loop; the techlead files one with request-stop.mjs.`,
    );
  }

  writeJson(runtimePath, {
    ...runtime,
    implementation_loop: {
      ...loop,
      last_reason: reason,
      last_transition_at: timestamp,
      last_transition_by: "set-next-role",
      next_role: role,
      // Choosing the next role completes the turn it was chosen in (see isTurnComplete).
      next_role_set_iteration: hasOpenTurn(loop) ? loop.iteration : (loop.next_role_set_iteration ?? null),
      prompt_file: promptFile,
      status,
      // A role choice replaces any stop request filed earlier in the turn; an engineer turn
      // ends the run of consecutive stop requests.
      stop_request: null,
      ...(role === "engineer" ? { stop_rounds: 0 } : {}),
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

// A role marks its open turn done, e.g. before ending it with a dev server still running in
// the background, so the loop records the report and chains instead of waiting.
export function completeTurn(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const timestamp = nowIso();
  const runtimePath = runtimeStatePath(root, slug);
  const runtime = normalizeObject(readJson(runtimePath, {}));
  const loop = normalizeObject(runtime.implementation_loop);

  if (!hasOpenTurn(loop)) {
    console.log(`No open implementation turn for ${slug}.`);
    return;
  }

  writeJson(runtimePath, {
    ...runtime,
    implementation_loop: { ...loop, turn_completed_iteration: loop.iteration },
    updated_at: timestamp,
  });

  appendLoopLog(root, {
    action: "role-command",
    command: "complete-turn",
    current_iteration: loop.iteration,
    current_role: loop.current_role,
    slug,
    timestamp,
  });

  console.log(
    `Marked ${loop.current_role} turn ${loop.iteration} of ${slug} complete. End the turn with your final report; the loop records it and starts the next role, even while background tasks keep running.`,
  );
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

  // The role ended its turn while a background task it started still runs and it has not
  // marked the turn complete: it is waiting. Let the host turn end without a report and pick
  // the role up when the task's notification (or the user) wakes the session.
  if (platform === "claude-code" && hasOpenTurn(loop) && shouldWaitForBackgroundTasks(loop, payload)) {
    waitForBackgroundTasks(projectRoot, slug, runtime, loop, payload, timestamp);
    return null;
  }

  ({ loop, runtime } = recordTurnStopIfNeeded(projectRoot, slug, runtime, loop, payload, timestamp));
  ({ loop, runtime } = recordStoppedTurnReportIfPending(projectRoot, slug, runtime, loop, payload, timestamp));
  ({ loop, runtime } = ensureClaudeBlockCapMetadata(projectRoot, slug, runtime, loop, timestamp));

  // A manager turn that opened a blocking gate ends here: the loop awaits the review.
  if (loop.status === "running" && awaitReviewIfBlocked(projectRoot, slug, runtime, loop, payload, timestamp)) {
    return null;
  }

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
  const resumesAbortedTurn = loop.resume_after_user_turn && role === loop.current_role;
  const { prompt, promptFile, stopChallenge, stopReview } = buildRolePrompt(projectRoot, slug, loop, role, iteration, capProximityRoute);
  // Only the final housekeeping turn before a finite-cap pause needs the manual-continue
  // note. With an uncapped run (CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=0) roles chain automatically,
  // so appending it to every prompt would misinform the agent.
  const resumedPrompt = resumesAbortedTurn ? prependResumeNote(prompt, role) : prompt;
  const platformPrompt = platform === "claude-code" && capProximityRoute ? appendClaudeManualContinueNote(resumedPrompt) : resumedPrompt;
  const followingRole = role === "engineer" ? "techlead" : role === "manager" ? "techlead" : WAITING_FOR_TURN_TRANSITION;

  const nextLoop = incrementClaudeBlockCount(
    {
      ...loop,
      active_turn_started_at: timestamp,
      active_turn_stopped_at: null,
      // A resumed role keeps the baseline of the turn the user aborted: tasks it started
      // before Esc are still its own work.
      background_task_baseline: resumesAbortedTurn && Array.isArray(loop.background_task_baseline) ? loop.background_task_baseline : runningBackgroundTaskIds(payload),
      background_wait_iteration: null,
      background_wait_ms: 0,
      current_role: role,
      iteration,
      last_continuation_at: timestamp,
      last_reason: capProximityRoute?.reason ?? loop.last_reason ?? null,
      last_session_id: payload.session_id ?? null,
      next_role: followingRole,
      resume_after_user_turn: false,
      status: "running",
      stop_challenge: stopChallenge ? null : (loop.stop_challenge ?? null),
      stop_review_iteration: stopReview ? iteration : null,
      turn_key: turnKeyOf(payload) ?? loop.turn_key ?? null,
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
    ...(stopReview ? { stop_review: true, stop_class: stopReview.class } : {}),
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

function buildRolePrompt(projectRoot, slug, loop, role, iteration, capProximityRoute) {
  // A manager turn routed by request-stop reviews that stop instead of doing housekeeping.
  const stopReview = role === "manager" && loop.stop_request ? loop.stop_request : null;
  // A challenged stop is delivered to the next techlead turn once.
  const stopChallenge = role === "techlead" && loop.stop_challenge ? loop.stop_challenge : null;

  if (stopReview) {
    return { prompt: buildStopReviewPrompt(projectRoot, slug, iteration, stopReview), promptFile: STOP_REVIEW_PROMPT_TEMPLATE_PATH, stopChallenge, stopReview };
  }

  if (role === "manager") {
    const prompt = buildManagerPrompt(slug, iteration, capProximityRoute?.reason ?? loop.last_reason ?? null);
    return { prompt, promptFile: MANAGER_PROMPT_TEMPLATE_PATH, stopChallenge, stopReview };
  }

  if (role === "techlead") {
    return { prompt: buildTechleadPrompt(slug, iteration, stopChallenge), promptFile: TECHLEAD_PROMPT_TEMPLATE_PATH, stopChallenge, stopReview };
  }

  return { prompt: buildEngineerPrompt(projectRoot, slug, loop, iteration), promptFile: loop.prompt_file ?? null, stopChallenge, stopReview };
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

export function mergeEpicStateIntoRuntime(projectRoot, slug, runtime) {
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

export function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

// Identity of the host turn that carries the loop. Claude Code keeps one `prompt_id`
// for a user turn and all its Stop-hook continuations; Codex reports `turn_id`.
export function turnKeyOf(payload) {
  return payload.prompt_id ?? payload.turn_id ?? null;
}

export function hasOpenTurn(loop) {
  return Boolean(loop.current_role && loop.active_turn_started_at && !loop.active_turn_stopped_at && loop.status === "running");
}

function recordTurnStopIfNeeded(projectRoot, slug, runtime, loop, payload, timestamp) {
  if (!loop.current_role || !loop.active_turn_started_at || loop.active_turn_stopped_at) {
    return { loop, runtime };
  }

  const backgroundWaitMs = waitedMs(loop, timestamp);
  const durationMs = activeDurationMs(loop, timestamp, backgroundWaitMs);
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
    ...(backgroundWaitMs > 0 ? { background_wait_ms: backgroundWaitMs } : {}),
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

// stop-loop closed an engineer or manager turn before the role finished it. The role's next
// final message is its report of that turn (what landed, what is left), so record it the way a
// completed turn's report is recorded; the loop stays stopped.
function recordStoppedTurnReportIfPending(projectRoot, slug, runtime, loop, payload, timestamp) {
  if (loop.status !== "interrupted" || !Number.isFinite(loop.stop_report_iteration) || loop.stop_report_iteration !== loop.iteration) {
    return { loop, runtime };
  }

  const role = loop.current_role;
  const report = appendRoleReportIfPresent(projectRoot, slug, loop, payload, timestamp, role);
  const nextLoop = {
    ...loop,
    ...(report ? { [`last_${role}_report_at`]: report.timestamp, [`last_${role}_report_path`]: report.latest_report_path } : {}),
    stop_report_iteration: null,
  };
  const nextRuntime = { ...runtime, implementation_loop: nextLoop, updated_at: timestamp };

  writeJson(runtimeStatePath(projectRoot, slug), nextRuntime);
  appendLoopLog(projectRoot, {
    action: "stopped-turn-report",
    iteration: loop.iteration,
    recorded: Boolean(report),
    role,
    session_id: payload.session_id ?? null,
    slug,
    timestamp,
  });

  return { loop: nextLoop, runtime: nextRuntime };
}

export function recordTurnInterrupted(projectRoot, slug, runtime, loop, { durationMs, reason, sessionId, timestamp, turnId }) {
  const resolvedDurationMs = durationMs === undefined ? activeDurationMs(loop, timestamp, waitedMs(loop, timestamp)) : durationMs;
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

// Wall-clock time of the open turn minus the time it spent waiting for background work.
function activeDurationMs(loop, timestamp, backgroundWaitMs) {
  const elapsedMs = durationMsBetween(loop.active_turn_started_at, timestamp);
  return elapsedMs === null || elapsedMs === undefined ? elapsedMs : Math.max(0, elapsedMs - backgroundWaitMs);
}

function skillScript(name) {
  return path.join(SKILL_DIR, "scripts", name);
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
