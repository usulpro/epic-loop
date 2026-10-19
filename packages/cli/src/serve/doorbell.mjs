import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// The doorbell (Phase 4 of the visual-review epic, D34, D37). When the human submits a gate's
// page or writes to the inbox while the loop awaits a review, the idle driver session must wake:
//   - Claude Code: the skill's asyncRewake waiter hook polls the disk, so the server only logs;
//   - Codex: the server rings the driver thread with `codex queue` (provisional, D37).
// Every attempt is a line in .epic-loop/epics/<slug>/.runtime/doorbell.jsonl.
export const DOORBELL_MARKER = "[epic-loop doorbell]";
const RING_TIMEOUT_MS = 10_000;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function doorbellPointer(slug, { inbox = [], problems = [], reviews = [] } = {}) {
  const parts = [
    reviews.length ? `answered reviews ${reviews.join(", ")}` : null,
    problems.length ? `problem reports on ${problems.join(", ")}` : null,
    inbox.length ? `inbox ${inbox.join(", ")}` : null,
  ].filter(Boolean);
  return `${DOORBELL_MARKER} epic ${slug}: the human's input arrived (${parts.join("; ") || "new input"}). Reply in one line and end the turn; the loop ingests it now.`;
}

function claudeWaiterInstalled(root) {
  const hooks = readJson(path.join(root, ".claude", "settings.json"))?.hooks;
  if (!hooks || typeof hooks !== "object") return false;
  return ["Stop", "SessionStart"].every((event) =>
    (Array.isArray(hooks[event]) ? hooks[event] : []).some((group) =>
      (Array.isArray(group?.hooks) ? group.hooks : []).some((hook) => hook?.asyncRewake === true && String(hook.command ?? "").includes("doorbell-waiter.mjs")),
    ),
  );
}

// How the loop learns about a submit right now: "waiter" | "codex-queue" (rung by the server),
// "loop-running" (picked up at the next role transition) or "none" (a message in the session).
export function doorbellMode(root, slug) {
  const platform = readJson(path.join(root, ".epic-loop", ".runtime", "platform.json"))?.platform ?? null;
  const loop = readJson(path.join(root, ".epic-loop", "epics", slug, ".runtime", "runtime-state.json"))?.implementation_loop;
  const status = loop?.status ?? null;
  if (status === "running") return { driver: loop.driver_session_id ?? null, mode: "loop-running", platform };
  if (status !== "awaiting-review") return { driver: null, mode: "none", platform };
  const driver = typeof loop.driver_session_id === "string" && loop.driver_session_id ? loop.driver_session_id : null;
  if (platform === "codex" && driver) return { driver, mode: "codex-queue", platform };
  if (platform === "claude-code" && claudeWaiterInstalled(root)) return { driver, mode: "waiter", platform };
  return { driver, mode: "none", platform };
}

function appendRecord(root, slug, record) {
  const file = path.join(root, ".epic-loop", "epics", slug, ".runtime", "doorbell.jsonl");
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
  } catch {}
}

// Rings for a submit or an inbox entry and returns the mode at once; the `codex queue` call
// finishes in the background and never holds up the HTTP response.
export function ringDoorbell(root, slug, { inbox, reason, review }) {
  const { driver, mode, platform } = doorbellMode(root, slug);
  const base = { at: new Date().toISOString(), platform, reason, ring: mode, ...(review ? { review } : {}), ...(inbox ? { inbox } : {}) };
  if (mode !== "codex-queue") {
    appendRecord(root, slug, base);
    return mode;
  }

  const bin = process.env.EPIC_LOOP_CODEX_BIN || "codex";
  const target = review ? [review] : [];
  const message = doorbellPointer(slug, { inbox: inbox ? [inbox] : [], problems: reason === "problem" ? target : [], reviews: reason === "problem" ? [] : target });
  const args = ["queue", "--thread", driver, "--message", message];
  const command = [bin, ...args];
  let settled = false;
  const finish = (fields) => {
    if (settled) return;
    settled = true;
    appendRecord(root, slug, { ...base, command, ...fields });
  };
  try {
    const child = spawn(bin, args, { cwd: root, stdio: ["ignore", "ignore", "pipe"], timeout: RING_TIMEOUT_MS });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-2000);
    });
    child.on("error", (error) => finish({ error: error.code === "ENOENT" ? `${bin} not found on PATH` : error.message, exitCode: null }));
    child.on("close", (code, signal) => finish({ exitCode: code, ...(code === 0 ? {} : { error: signal ? `killed by ${signal}` : stderr.trim().slice(-500) || `exit ${code}` }) }));
  } catch (error) {
    finish({ error: error.message, exitCode: null });
  }
  return mode;
}
