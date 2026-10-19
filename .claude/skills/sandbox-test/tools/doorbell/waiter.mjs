// Waits until answers are pending (answers.json newer than the last pickup), then signals the session.
// Usage:
//   node waiter.mjs --mode background [--dir D] [--timeout 1800]
//     Claude Code run_in_background waiter: prints the pointer on stdout and exits 0; the host's
//     task-notification is the ring.
//   node waiter.mjs --mode rewake --form event|session [--dir D] [--timeout 86400]
//     Claude Code asyncRewake hook command: reads the hook payload on stdin, prints the pointer on stderr
//     and exits 2, which wakes the model. Only one rewake waiter runs at a time (waiter.pid lock), so an
//     event hook that fires every turn does not stack waiters.
// Every step is logged to probe-log.jsonl, including SIGTERM/SIGHUP (shows how the host ends a waiter).
import fs from "node:fs";
import { hookFields, logEvent, parseArgs, paths, pendingAnswers, pointer, probeDir, readStdinJson, sleep } from "./lib.mjs";

const flags = parseArgs(process.argv.slice(2));
const dir = probeDir(flags);
const p = paths(dir);
const mode = flags.mode || "background";
const form = flags.form || null;
const timeoutMs = Number(flags.timeout || (mode === "rewake" ? 86400 : 1800)) * 1000;
const mechanism = mode === "rewake" ? `asyncRewake-${form || "event"}` : "run_in_background";
const startedAt = Date.now();
let ownsLock = false;

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function releaseLock() {
  if (!ownsLock) return;
  try {
    if (fs.readFileSync(p.waiterLock, "utf8").trim() === String(process.pid)) fs.rmSync(p.waiterLock);
  } catch {}
}

for (const signal of ["SIGTERM", "SIGHUP", "SIGINT"]) {
  process.on(signal, () => {
    logEvent(dir, "waiter-killed", { mechanism, signal, aliveMs: Date.now() - startedAt });
    releaseLock();
    process.exit(0);
  });
}

const payload = mode === "rewake" ? await readStdinJson() : null;
logEvent(dir, mode === "rewake" ? "hook-fire" : "waiter-armed", { mechanism, ...hookFields(payload) });

if (mode === "rewake") {
  fs.mkdirSync(dir, { recursive: true });
  const holder = Number(fs.existsSync(p.waiterLock) ? fs.readFileSync(p.waiterLock, "utf8").trim() : 0);
  if (holder && holder !== process.pid && alive(holder)) {
    logEvent(dir, "waiter-skip", { mechanism, reason: `waiter ${holder} already armed` });
    process.exit(0);
  }
  fs.writeFileSync(p.waiterLock, String(process.pid));
  ownsLock = true;
  logEvent(dir, "waiter-armed", { mechanism, timeoutMs });
}

while (Date.now() - startedAt < timeoutMs) {
  const answers = pendingAnswers(dir);
  if (answers) {
    const text = pointer(dir, answers);
    logEvent(dir, "waiter-fired", { mechanism, answersId: answers.id, pointer: text });
    releaseLock();
    if (mode === "rewake") {
      process.stderr.write(`${text}\n`);
      process.exit(2);
    }
    process.stdout.write(`${text}\n`);
    process.exit(0);
  }
  await sleep(250);
}
logEvent(dir, "waiter-timeout", { mechanism, aliveMs: Date.now() - startedAt });
releaseLock();
process.exit(0);
