// Kills leftover processes whose command line mentions the given sandbox path (doorbell waiters,
// a server the stop missed), never this process or its parents. Usage: node reap.mjs <sandbox>
import { execFileSync } from "node:child_process";

const [sandbox] = process.argv.slice(2);
if (!sandbox || sandbox.length < 20) throw new Error("refusing a short sandbox path");
const protectedPids = new Set([process.pid, process.ppid]);
const rows = execFileSync("ps", ["-eo", "pid=,args="], { encoding: "utf8" }).trim().split("\n");
for (const row of rows) {
  const [pidText, ...rest] = row.trim().split(/\s+/u);
  const pid = Number(pidText);
  const args = rest.join(" ");
  // Only the epic-loop processes a cell leaves behind: doorbell waiters and review servers.
  if (protectedPids.has(pid) || !args.includes(sandbox) || !/doorbell-waiter\.mjs|cli\.mjs serve|serve-worker/u.test(args)) continue;
  console.log(`reap ${pid} ${args.slice(0, 160)}`);
  try {
    process.kill(pid, "SIGTERM");
  } catch {}
}
