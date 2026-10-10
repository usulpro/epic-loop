import { runtimeStatePath, writeJson } from "./common.mjs";
import { appendLoopLog } from "./loop-artifacts.mjs";

// Claude Code lets a turn end while its background tasks keep running and wakes the session
// with a `<task-notification>` when they finish; its Stop payload lists them in
// `background_tasks`. A role that ends its turn to wait that way has not written its report
// yet, so the loop defers the report and the next role once per role turn. Only tasks the
// role started count: anything already running when the turn began (e.g. a dev server left
// by an earlier role) never sends the notification that would wake the turn.

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

export function shouldWaitForBackgroundTasks(loop, payload) {
  return loop.background_wait_iteration !== loop.iteration && newBackgroundTaskIds(loop, payload).length > 0;
}

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
