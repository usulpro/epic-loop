import path from "node:path";

import { nowIso, readJson, requireFlag, resolveRoot, runtimeStatePath, writeJson } from "./common.mjs";
import { appendLoopLog } from "./loop-artifacts.mjs";
import { isWaitingForBackgroundTasks, waitedMs, waitingTurnGuidance } from "./loop-background.mjs";
import { hasOpenTurn, mergeEpicStateIntoRuntime, normalizeObject, recordTurnInterrupted, turnKeyOf } from "./loop.mjs";
import { AWAITING_REVIEW, openGates, reviewPath } from "./loop-gates.mjs";
import { SKILL_DIR, completeTurnCommand } from "./loop-prompts.mjs";

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
    return hasOpenTurn(loop) ? continueOpenTurn(projectRoot, slug, runtime, loop, payload, { logBase, timestamp }) : null;
  }

  if (loop.status === "interrupted") {
    return userPromptContext(`[epic-loop] epic=${slug} mode=implementation — loop stopped. If the user asks to resume it, run: ${resumeCommand(slug)}`);
  }

  if (loop.status === AWAITING_REVIEW) {
    if (isStopLoopCommand(payload.prompt)) {
      stopLoop(projectRoot, slug, { reason: "user-stop-command", sessionId: payload.session_id ?? null, timestamp, turnId: turnKeyOf(payload) });
      return userPromptContext(
        `[epic-loop] epic=${slug} mode=implementation — the user stopped the loop while it awaited a review. Confirm the loop is stopped and that it resumes with: ${resumeCommand(slug)}`,
      );
    }
    return userPromptContext(awaitingReviewNote(slug, loop));
  }

  if (loop.status !== "running") {
    return null;
  }

  if (isStopLoopCommand(payload.prompt)) {
    const { reportRole } = stopLoop(projectRoot, slug, { reason: "user-stop-command", sessionId: payload.session_id ?? null, timestamp, turnId: turnKeyOf(payload) });
    return userPromptContext(
      `[epic-loop] epic=${slug} mode=implementation — the user stopped the loop. Do not continue any loop role.${stoppedTurnReportNote(reportRole)} Confirm the loop is stopped and that it resumes with: ${resumeCommand(slug)}`,
    );
  }

  if (!hasOpenTurn(loop)) {
    if (loop.next_role === "awaiting-transition") {
      return userPromptContext(
        `[epic-loop] epic=${slug} mode=implementation — loop running, but the last techlead turn ended without choosing the next role, so nothing runs after this reply. Tell the user; only if they want the loop to go on, choose it as the techlead would: node ${path.join(SKILL_DIR, "scripts", "set-next-role.mjs")} --slug ${slug} --role <engineer|manager|idle> (engineer also needs --prompt-file). ${stopHint(slug)}`,
      );
    }
    return userPromptContext(`[epic-loop] epic=${slug} mode=implementation — loop running. Answer the user; the loop continues after this reply. ${stopHint(slug)}`);
  }

  const role = loop.current_role;
  const key = turnKeyOf(payload);

  // The role ended its host turn to wait for its background work, so this message is not an
  // abort: it wakes the same role turn, which answers and carries on.
  if (isWaitingForBackgroundTasks(loop)) {
    wakeWaitingTurn(projectRoot, slug, runtime, loop, key, timestamp);
    appendLoopLog(projectRoot, { action: "user-message-while-waiting", ...logBase });
    return userPromptContext(
      `[epic-loop] epic=${slug} mode=implementation — the user wrote while the ${role} turn was waiting for its background work. Answer briefly, then continue the ${role} turn. ${waitingTurnGuidance(role, completeTurnCommand(slug))} ${stopHint(slug)}`,
    );
  }

  if (key && loop.turn_key && key === loop.turn_key) {
    appendLoopLog(projectRoot, { action: "user-message-in-turn", ...logBase });
    return userPromptContext(
      `[epic-loop] epic=${slug} mode=implementation — the user wrote during the ${role} turn. Answer briefly, then finish the ${role} turn: your final message must still be the complete ${role} report, because the loop records it. ${stopHint(slug)}`,
    );
  }

  // A new host turn while a role turn is still open: the user aborted that turn (Esc /
  // Ctrl+C), which fires no Stop. Close it without a report and, once this user turn ends,
  // resume the same role (or the next role it already chose), so the answer is never taken
  // for the role's report.
  const nextRole = abortOpenTurn(projectRoot, slug, runtime, loop, { sessionId: payload.session_id ?? null, timestamp, turnId: key });
  const continuation = nextRole === role ? `the loop resumes the ${role} turn` : `the loop continues with the ${nextRole} turn the ${role} already chose`;
  return userPromptContext(
    `[epic-loop] epic=${slug} mode=implementation — the user interrupted the ${role} turn. Answer the user's message; when you finish, ${continuation}. ${stopHint(slug)}`,
  );
}

// A harness-injected prompt never ends the open role turn. When it wakes an idle session (a
// background task finished after the role ended its turn to wait, or after Esc), it starts a
// new host turn that carries the role turn on, so the loop adopts that turn's identity. A
// waiting role gets the same guidance whichever host turn the notification arrives in.
function continueOpenTurn(projectRoot, slug, runtime, loop, payload, { logBase, timestamp }) {
  const key = turnKeyOf(payload);
  const adoptKey = Boolean(key) && key !== loop.turn_key;
  const waiting = isWaitingForBackgroundTasks(loop);
  if (adoptKey || waiting) {
    wakeWaitingTurn(projectRoot, slug, runtime, loop, key, timestamp);
  }
  appendLoopLog(projectRoot, { action: "synthetic-prompt-ignored", reason: "harness-injected-prompt", turn_key_adopted: adoptKey, ...logBase });

  if (!waiting) {
    return null;
  }
  const role = loop.current_role;
  return userPromptContext(
    `[epic-loop] epic=${slug} mode=implementation — background work finished while the ${role} turn was waiting. ${waitingTurnGuidance(role, completeTurnCommand(slug))}`,
  );
}

// The session is awake again inside the open role turn: it carries the host turn `key`, and
// the next Stop decides afresh whether the role waits again or reports.
function wakeWaitingTurn(projectRoot, slug, runtime, loop, key, timestamp) {
  writeJson(runtimeStatePath(projectRoot, slug), {
    ...runtime,
    implementation_loop: { ...loop, background_wait_iteration: null, background_wait_ms: waitedMs(loop, timestamp), turn_key: key ?? loop.turn_key ?? null },
    updated_at: timestamp,
  });
}

export function stopLoopCommand(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const reason = typeof flags.reason === "string" && flags.reason.trim() ? flags.reason.trim() : "user-requested-stop";
  const stopped = stopLoop(root, slug, { reason, sessionId: flags["session-id"] ?? null, timestamp: nowIso(), turnId: null });

  if (!stopped) {
    console.log(`Implementation loop for ${slug} is not running.`);
    return;
  }
  console.log(`Stopped the implementation loop for ${slug}.${stoppedTurnReportNote(stopped.reportRole)} Resume with: ${resumeCommand(slug)}`);
}

// Roles whose final message the loop keeps as a report; the techlead hands over through
// briefs and set-next-role instead.
const REPORTING_ROLES = ["engineer", "manager"];

// Stops the loop. An open engineer or manager turn is closed at once, and the role's next final
// message is recorded as the report of that stopped turn (see recordStoppedTurnReportIfPending),
// so the work it did is not lost to the next session. Returns { reportRole } or false.
function stopLoop(projectRoot, slug, { reason, sessionId, timestamp, turnId }) {
  const runtimePath = runtimeStatePath(projectRoot, slug);
  const runtime = mergeEpicStateIntoRuntime(projectRoot, slug, normalizeObject(readJson(runtimePath, {})));
  const loop = normalizeObject(runtime.implementation_loop);

  if (loop.status !== "running" && loop.status !== AWAITING_REVIEW) {
    return false;
  }

  // stop-loop.mjs runs inside the driver session but cannot see its id.
  const stoppingSessionId = sessionId ?? loop.driver_session_id ?? null;
  const reportRole = hasOpenTurn(loop) && REPORTING_ROLES.includes(loop.current_role) ? loop.current_role : null;

  if (hasOpenTurn(loop)) {
    const interrupted = recordTurnInterrupted(projectRoot, slug, runtime, loop, { reason, sessionId: stoppingSessionId, timestamp, turnId });
    if (reportRole) {
      writeJson(runtimePath, { ...interrupted, implementation_loop: { ...interrupted.implementation_loop, stop_report_iteration: loop.iteration } });
    }
  } else {
    writeJson(runtimeStatePath(projectRoot, slug), {
      ...runtime,
      implementation_loop: { ...loop, last_reason: reason, next_role: "idle", status: "interrupted" },
      updated_at: timestamp,
    });
  }

  appendLoopLog(projectRoot, { action: "loop-stopped", reason, role: loop.current_role ?? null, session_id: stoppingSessionId, slug, timestamp });
  return { reportRole };
}

// A blocking gate ended the manager's turn: nothing runs until the human answers the page or
// the loop is resumed explicitly.
function awaitingReviewNote(slug, loop) {
  const waiting = openGates(loop).filter((gate) => gate.blocking);
  const reviews = (waiting.length > 0 ? waiting : openGates(loop)).map((gate) => `${gate.review} (${reviewPath(slug, gate.review)})`);
  return `[epic-loop] epic=${slug} mode=implementation — loop awaiting review: ${reviews.join(", ") || "none listed"}. Nothing runs after this reply. Answer the user; the human answers that page in the epic-loop app (epic-loop serve). Only if the user asks to continue the loop now, resume it: ${resumeCommand(slug)}. ${stopHint(slug)}`;
}

function stoppedTurnReportNote(role) {
  return role
    ? ` End this turn with your ${role} report of the stopped turn: what it changed, what it verified, and what is left unfinished. The loop records it for the next session.`
    : "";
}

function abortOpenTurn(projectRoot, slug, runtime, loop, { sessionId, timestamp, turnId }) {
  const nextRole = roleChosenDuringTurn(loop) ? loop.next_role : loop.current_role;
  writeJson(runtimeStatePath(projectRoot, slug), {
    ...runtime,
    implementation_loop: {
      ...loop,
      active_turn_stopped_at: timestamp,
      last_reason: "user-aborted-turn",
      next_role: nextRole,
      resume_after_user_turn: nextRole === loop.current_role,
    },
    updated_at: timestamp,
  });

  appendLoopLog(projectRoot, {
    action: "turn-aborted",
    // Esc fires no hook, so when the role stopped working is unknown; the time until the user
    // wrote is not active time.
    duration_ms: null,
    ended_at: timestamp,
    iteration: Number.isFinite(loop.iteration) ? loop.iteration : null,
    next_role: nextRole,
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

  return nextRole;
}

// The techlead's `set-next-role` inside the aborted turn already decided what comes next;
// re-running the role would only redo that decision. Matched by iteration, not by timestamp,
// so neither a command in the second the turn started nor one from the previous turn is
// misread.
function roleChosenDuringTurn(loop) {
  return Boolean(loop.next_role) && Number.isFinite(loop.iteration) && loop.next_role_set_iteration === loop.iteration;
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
