import { runtimeStatePath, writeJson } from "./common.mjs";
import { appendLoopLog } from "./loop-artifacts.mjs";

// Claude Code lets a turn end while its background tasks keep running and wakes the session
// with a `<task-notification>` when they finish; its Stop payload lists them in
// `background_tasks`. A role that ends its turn while a task it started still runs is waiting
// for it, so the loop records no report and starts no next role, as often as that happens in
// one role turn. A role that is done and leaves a task running on purpose (a dev server)
// says so explicitly: `complete-turn.mjs`, or `set-next-role.mjs` for the techlead. Only
// tasks the role started count: anything already running when the turn began (e.g. a dev
// server left by an earlier role) never sends the notification that would wake the turn.

export function runningBackgroundTaskIds(payload) {
  if (!Array.isArray(payload.background_tasks)) {
    return [];
  }

  return payload.background_tasks.filter((task) => task && typeof task.id === "string" && task.status === "running").map((task) => task.id);
}

export function newBackgroundTaskIds(loop, payload) {
  const baseline = new Set(Array.isArray(loop.background_task_baseline) ? loop.background_task_baseline : []);
  return runningBackgroundTaskIds(payload).filter((id) => !baseline.has(id));
}

// The role marked the open turn done: `complete-turn` or `set-next-role` ran inside it.
export function isTurnComplete(loop) {
  return Number.isFinite(loop.iteration) && (loop.turn_completed_iteration === loop.iteration || loop.next_role_set_iteration === loop.iteration);
}

export function shouldWaitForBackgroundTasks(loop, payload) {
  return !isTurnComplete(loop) && newBackgroundTaskIds(loop, payload).length > 0;
}

// The open role turn ended its host turn to wait and nothing has woken the session since.
export function isWaitingForBackgroundTasks(loop) {
  return Number.isFinite(loop.iteration) && loop.background_wait_iteration === loop.iteration;
}

export function waitForBackgroundTasks(projectRoot, slug, runtime, loop, payload, timestamp) {
  const taskIds = newBackgroundTaskIds(loop, payload);

  writeJson(runtimeStatePath(projectRoot, slug), {
    ...runtime,
    implementation_loop: {
      ...loop,
      background_wait_iteration: loop.iteration,
      background_wait_started_at: timestamp,
      background_wait_task_ids: taskIds,
    },
    updated_at: timestamp,
  });

  appendLoopLog(projectRoot, {
    action: "turn-waiting-background",
    background_task_ids: taskIds,
    iteration: Number.isFinite(loop.iteration) ? loop.iteration : null,
    phase: runtime.active_phase ?? null,
    role: loop.current_role,
    session_id: payload.session_id ?? null,
    slug,
    task: runtime.active_task ?? null,
    timestamp,
  });
}

// What a waiting role is told when the session wakes up. Shared by notification wakes and
// user messages, so both carry the same rule for ending the turn.
export function waitingTurnGuidance(role, completeTurnCommand) {
  return [
    `Continue the ${role} turn: if background work you started is still running and you need its result, end your turn again and the loop keeps waiting.`,
    `If you leave a process running on purpose (e.g. a dev server), run ${completeTurnCommand} first.`,
    `When the turn is done, your final message must be the complete ${role} report, because the loop records it.`,
  ].join(" ");
}
