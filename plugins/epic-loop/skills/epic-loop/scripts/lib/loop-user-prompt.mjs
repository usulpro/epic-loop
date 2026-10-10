import path from "node:path";

import { nowIso, readJson, requireFlag, resolveRoot, runtimeStatePath, writeJson } from "./common.mjs";
import { appendLoopLog, durationMsBetween } from "./loop-artifacts.mjs";
import { hasOpenTurn, mergeEpicStateIntoRuntime, normalizeObject, recordTurnInterrupted, turnKeyOf } from "./loop.mjs";
import { SKILL_DIR } from "./loop-prompts.mjs";

// A user message never stops the implementation loop by itself. The loop stops only on an
// explicit request: the agent runs `stop-loop.mjs` when the user asks in any wording, and
// the exact `stop loop mode` phrase is handled here deterministically as a safety rail.
const STOP_COMMAND = /^\s*stop loop mode[\s.!]*$/iu;

// Claude Code delivers background-task completions (`<task-notification>`) and other harness
// injections through UserPromptSubmit. A prompt is synthetic when nothing remains after
// stripping those wrapper blocks; a missing prompt is not.
const SYNTHETIC_PROMPT_BLOCKS = [/<task-notification>[\s\S]*?<\/task-notification>/gu, /<system-reminder>[\s\S]*?<\/system-reminder>/gu];

export function isSyntheticUserPrompt(prompt) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    return false;
  }
  const stripped = SYNTHETIC_PROMPT_BLOCKS.reduce((text, pattern) => text.replace(pattern, ""), prompt);
  return stripped.trim() === "";
}

export function isStopLoopCommand(prompt) {
  return typeof prompt === "string" && STOP_COMMAND.test(prompt);
}

// Routes a UserPromptSubmit from the implementation driver session. Returns hook output
// (additionalContext for the agent) or null.
export function handleDriverUserPrompt(projectRoot, payload, binding) {
  if (payload.hook_event_name !== "UserPromptSubmit") {
    return null;
  }

  const slug = binding.epic_slug;
  const timestamp = nowIso();
  const runtime = mergeEpicStateIntoRuntime(projectRoot, slug, normalizeObject(readJson(runtimeStatePath(projectRoot, slug), {})));
  const loop = normalizeObject(runtime.implementation_loop);

  if (runtime.mode !== "implementation" || loop.driver_session_id !== payload.session_id) {
    return null;
  }

  const logBase = { iteration: Number.isFinite(loop.iteration) ? loop.iteration : null, role: loop.current_role ?? null, session_id: payload.session_id ?? null, slug, timestamp };

  if (isSyntheticUserPrompt(payload.prompt)) {
    if (hasOpenTurn(loop)) {
      appendLoopLog(projectRoot, { action: "synthetic-prompt-ignored", reason: "harness-injected-prompt", ...logBase });
    }
    return null;
  }

  if (loop.status === "interrupted") {
    return userPromptContext(`[epic-loop] epic=${slug} mode=implementation — loop stopped. If the user asks to resume it, run: ${resumeCommand(slug)}`);
  }

  if (loop.status !== "running") {
    return null;
  }

  if (isStopLoopCommand(payload.prompt)) {
    stopLoop(projectRoot, slug, { reason: "user-stop-command", sessionId: payload.session_id ?? null, timestamp, turnId: turnKeyOf(payload) });
    return userPromptContext(
      `[epic-loop] epic=${slug} mode=implementation — the user stopped the loop. Do not continue any loop role; confirm the loop is stopped and that it resumes with: ${resumeCommand(slug)}`,
    );
  }

  if (!hasOpenTurn(loop)) {
    return userPromptContext(`[epic-loop] epic=${slug} mode=implementation — loop running. Answer the user; the loop continues after this reply. ${stopHint(slug)}`);
  }

  const role = loop.current_role;
  const key = turnKeyOf(payload);
  if (key && loop.turn_key && key === loop.turn_key) {
    appendLoopLog(projectRoot, { action: "user-message-in-turn", ...logBase });
    return userPromptContext(
      `[epic-loop] epic=${slug} mode=implementation — the user wrote during the ${role} turn. Answer briefly, then finish the ${role} turn: your final message must still be the complete ${role} report, because the loop records it. ${stopHint(slug)}`,
    );
  }

  // A new host turn while a role turn is still open: the user aborted that turn (Esc /
  // Ctrl+C), which fires no Stop. Close it without a report and resume the same role
  // once this user turn ends, so the answer is never taken for the role's report.
  abortOpenTurn(projectRoot, slug, runtime, loop, { sessionId: payload.session_id ?? null, timestamp, turnId: key });
  return userPromptContext(
    `[epic-loop] epic=${slug} mode=implementation — the user interrupted the ${role} turn. Answer the user's message; when you finish, the loop resumes the ${role} turn. ${stopHint(slug)}`,
  );
}

export function stopLoopCommand(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const reason = typeof flags.reason === "string" && flags.reason.trim() ? flags.reason.trim() : "user-requested-stop";
  const stopped = stopLoop(root, slug, { reason, sessionId: flags["session-id"] ?? null, timestamp: nowIso(), turnId: null });

  console.log(stopped ? `Stopped the implementation loop for ${slug}. Resume with: ${resumeCommand(slug)}` : `Implementation loop for ${slug} is not running.`);
}

function stopLoop(projectRoot, slug, { reason, sessionId, timestamp, turnId }) {
  const runtime = mergeEpicStateIntoRuntime(projectRoot, slug, normalizeObject(readJson(runtimeStatePath(projectRoot, slug), {})));
  const loop = normalizeObject(runtime.implementation_loop);

  if (loop.status !== "running") {
    return false;
  }

  if (hasOpenTurn(loop)) {
    recordTurnInterrupted(projectRoot, slug, runtime, loop, { reason, sessionId, timestamp, turnId });
  } else {
    writeJson(runtimeStatePath(projectRoot, slug), {
      ...runtime,
      implementation_loop: { ...loop, last_reason: reason, next_role: "idle", status: "interrupted" },
      updated_at: timestamp,
    });
  }

  appendLoopLog(projectRoot, { action: "loop-stopped", reason, role: loop.current_role ?? null, session_id: sessionId, slug, timestamp });
  return true;
}

function abortOpenTurn(projectRoot, slug, runtime, loop, { sessionId, timestamp, turnId }) {
  writeJson(runtimeStatePath(projectRoot, slug), {
    ...runtime,
    implementation_loop: {
      ...loop,
      active_turn_stopped_at: timestamp,
      last_reason: "user-aborted-turn",
      next_role: loop.current_role,
      resume_after_user_turn: true,
    },
    updated_at: timestamp,
  });

  appendLoopLog(projectRoot, {
    action: "turn-aborted",
    duration_ms: durationMsBetween(loop.active_turn_started_at, timestamp),
    ended_at: timestamp,
    iteration: Number.isFinite(loop.iteration) ? loop.iteration : null,
    phase: runtime.active_phase ?? null,
    reason: "user-aborted-turn",
    role: loop.current_role,
    session_id: sessionId,
    slug,
    started_at: loop.active_turn_started_at,
    task: runtime.active_task ?? null,
    timestamp,
    turn_id: turnId ?? null,
  });
}

function stopHint(slug) {
  return `Only if the user asks to stop or pause the loop, run: node ${path.join(SKILL_DIR, "scripts", "stop-loop.mjs")} --slug ${slug}`;
}

function resumeCommand(slug) {
  return `node ${path.join(SKILL_DIR, "scripts", "bind-session.mjs")} --current --slug ${slug} --mode implementation`;
}

function userPromptContext(text) {
  return { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: text } };
}
