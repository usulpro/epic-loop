// Shared helpers for the doorbell probe kit. Node built-ins only.
// Every kit script works on one probe directory (default `<cwd>/.doorbell`, override with `--dir` or DOORBELL_DIR):
//   answers.json     the human's answers, with submittedAt (source of truth)
//   pickup.json      the last pickup marker written by the session under test
//   probe-log.jsonl  append-only event log (server, waiters, hooks, pickups)
//   server.json      answers server port and pid
//   thread-id        Codex thread id registered by the session (codex-queue ringer)
import fs from "node:fs";
import path from "node:path";

export function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else {
      flags[key] = next;
      i += 1;
    }
  }
  return flags;
}

export function probeDir(flags = {}) {
  return path.resolve(flags.dir || process.env.DOORBELL_DIR || path.join(process.cwd(), ".doorbell"));
}

export function paths(dir) {
  return {
    dir,
    answers: path.join(dir, "answers.json"),
    pickup: path.join(dir, "pickup.json"),
    log: path.join(dir, "probe-log.jsonl"),
    server: path.join(dir, "server.json"),
    threadId: path.join(dir, "thread-id"),
    waiterLock: path.join(dir, "waiter.pid"),
  };
}

export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

export function logEvent(dir, event, fields = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const line = { at: new Date().toISOString(), event, pid: process.pid, ...fields };
  fs.appendFileSync(paths(dir).log, `${JSON.stringify(line)}\n`);
  return line;
}

// Answers are pending when answers.json exists and is newer than the last pickup.
export function pendingAnswers(dir) {
  const p = paths(dir);
  const answers = readJson(p.answers);
  if (!answers?.submittedAt) return null;
  const pickup = readJson(p.pickup);
  if (pickup?.answersSubmittedAt && Date.parse(pickup.answersSubmittedAt) >= Date.parse(answers.submittedAt)) return null;
  return answers;
}

export function pointer(dir, answers) {
  return `Doorbell: answers submitted at ${answers.submittedAt}. Read ${paths(dir).answers}, then run the pickup command from your probe instruction.`;
}

export async function readStdinJson() {
  if (process.stdin.isTTY) return null;
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

// Fields worth keeping from a hook payload (Claude Code and Codex use the same names).
export function hookFields(payload) {
  if (!payload) return {};
  return {
    hookEvent: payload.hook_event_name ?? null,
    sessionId: payload.session_id ?? null,
    turnId: payload.turn_id ?? null,
    promptId: payload.prompt_id ?? undefined,
    backgroundTasks: Array.isArray(payload.background_tasks) ? payload.background_tasks.map((t) => t.status ?? "?") : undefined,
    stopHookActive: payload.stop_hook_active ?? null,
    prompt: typeof payload.prompt === "string" ? payload.prompt.slice(0, 300) : undefined,
    tool: payload.tool_name ?? undefined,
    command: typeof payload.tool_input?.command === "string" ? payload.tool_input.command.slice(0, 200) : undefined,
    source: payload.source ?? undefined,
  };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
