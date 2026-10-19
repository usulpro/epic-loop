// Run by a Codex session under test: stores its thread id (CODEX_THREAD_ID, set in Codex shell commands)
// in the probe dir, so the answers server can ring it with `codex queue --thread <id>`.
// Usage: node register-thread.mjs [--dir D] [--thread-id ID]
import fs from "node:fs";
import { logEvent, parseArgs, paths, probeDir } from "./lib.mjs";

const flags = parseArgs(process.argv.slice(2));
const dir = probeDir(flags);
const threadId = typeof flags["thread-id"] === "string" ? flags["thread-id"] : process.env.CODEX_THREAD_ID;
if (!threadId) {
  logEvent(dir, "register-thread-failed", { reason: "CODEX_THREAD_ID is not set" });
  console.error("CODEX_THREAD_ID is not set in this shell; pass --thread-id.");
  process.exit(1);
}
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(paths(dir).threadId, `${threadId}\n`);
logEvent(dir, "register-thread", { threadId });
console.log(`registered thread ${threadId}`);
