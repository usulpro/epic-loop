import fs from "node:fs";
import path from "node:path";

import { epicRuntimeRoot, readJson, resolveRoot, runtimeStatePath, sessionRoot } from "./common.mjs";
import { appendLoopLog } from "./loop-artifacts.mjs";
import { AWAITING_REVIEW } from "./loop-gates.mjs";
import { describePendingInput, hasInput, pendingHumanInput } from "./loop-ingest.mjs";

// The Claude Code doorbell (D34 of the visual-review epic). An asyncRewake hook on Stop and
// SessionStart runs this waiter; it costs nothing unless its session drives a loop that awaits
// a review. Then it holds a per-epic lock, polls the disk for the human's input and, when some
// arrives, prints a pointer on stderr and exits 2: Claude Code wakes the idle session with it,
// and the next Stop resumes the loop through the ingest turn. The CLI server rings Codex instead
// (`codex queue`, D37) with the same marker, so the hook recognizes either wake.
export const DOORBELL_MARKER = "[epic-loop doorbell]";
export const DOORBELL_REWAKE_TIMEOUT_SECONDS = 86400;
export const DOORBELL_REWAKE_MESSAGE = "epic-loop:";
const DEFAULT_POLL_MS = 1000;

export function doorbellPointer(slug, { inbox = [], problems = [], reviews = [] } = {}) {
  const parts = [
    reviews.length ? `answered reviews ${reviews.join(", ")}` : null,
    problems.length ? `problem reports on ${problems.join(", ")}` : null,
    inbox.length ? `inbox ${inbox.join(", ")}` : null,
  ].filter(Boolean);
  return `${DOORBELL_MARKER} epic ${slug}: the human's input arrived (${parts.join("; ") || "new input"}). Reply in one line and end the turn; the loop ingests it now.`;
}

export function isDoorbellWake(prompt) {
  return typeof prompt === "string" && prompt.includes(DOORBELL_MARKER);
}

function waiterLockPath(root, slug) {
  return path.join(epicRuntimeRoot(root, slug), "doorbell-waiter.lock");
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLockPid(lockPath) {
  try {
    return Number(fs.readFileSync(lockPath, "utf8").trim()) || 0;
  } catch {
    return 0;
  }
}

// The epic whose loop this session drives while it awaits a review, or null.
export function awaitingEpicFor(root, sessionId) {
  const sessions = readJson(path.join(sessionRoot(root), "session-bindings.json"), {})?.sessions ?? {};
  const binding = sessions[sessionId];
  if (!binding || binding.active !== true || !binding.epic_slug) return null;
  const loop = readJson(runtimeStatePath(root, binding.epic_slug), {})?.implementation_loop ?? {};
  return loop.status === AWAITING_REVIEW && loop.driver_session_id === sessionId ? binding.epic_slug : null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Returns the exit code: 0 (nothing to do, another waiter, the loop moved on, lock lost) or 2 (rang).
export async function runDoorbellWaiter({ payload, root: rootFlag, env = process.env, stderr = process.stderr }) {
  const root = resolveRoot(rootFlag ?? payload?.cwd);
  const sessionId = payload?.session_id ? String(payload.session_id) : null;
  const slug = sessionId ? awaitingEpicFor(root, sessionId) : null;
  if (!slug) return 0;

  const lockPath = waiterLockPath(root, slug);
  const holder = readLockPid(lockPath);
  if (holder && holder !== process.pid && alive(holder)) return 0;
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, String(process.pid));
  const release = () => {
    if (readLockPid(lockPath) === process.pid) fs.rmSync(lockPath, { force: true });
  };
  for (const signal of ["SIGTERM", "SIGHUP", "SIGINT"]) {
    process.on(signal, () => {
      release();
      process.exit(0);
    });
  }

  const pollMs = Number(env.EPIC_LOOP_DOORBELL_POLL_MS) > 0 ? Number(env.EPIC_LOOP_DOORBELL_POLL_MS) : DEFAULT_POLL_MS;
  for (;;) {
    if (readLockPid(lockPath) !== process.pid) return 0;
    const loop = readJson(runtimeStatePath(root, slug), {})?.implementation_loop ?? {};
    if (loop.status !== AWAITING_REVIEW || loop.driver_session_id !== sessionId) {
      release();
      return 0;
    }
    const pending = pendingHumanInput(root, slug, loop);
    if (hasInput(pending)) {
      const reviews = pending.gates.map((gate) => gate.review);
      const problems = pending.problems.map((entry) => entry.review);
      const inbox = pending.inbox.map((entry) => entry.id);
      appendLoopLog(root, {
        action: "doorbell-ring",
        inbox_ids: inbox,
        mechanism: "asyncRewake",
        pending: describePendingInput(pending),
        problem_reviews: problems,
        reviews,
        session_id: sessionId,
        slug,
        timestamp: new Date().toISOString(),
      });
      release();
      stderr.write(`${doorbellPointer(slug, { inbox, problems, reviews })}\n`);
      return 2;
    }
    await sleep(pollMs);
  }
}
