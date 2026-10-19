#!/usr/bin/env node

// Claude Code asyncRewake doorbell waiter, installed on Stop and SessionStart by install-hooks.mjs.
// Exits 0 at once unless this session drives a loop that awaits a review; exits 2 with a pointer
// on stderr when the human's input arrives, which wakes the session.
import process from "node:process";

import { parseArgs } from "./lib/common.mjs";
import { runDoorbellWaiter } from "./lib/loop-doorbell.mjs";

async function readStdin() {
  if (process.stdin.isTTY) return "";
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

const { flags } = parseArgs(process.argv.slice(2));
let payload = {};
try {
  const raw = await readStdin();
  payload = raw.trim() ? JSON.parse(raw) : {};
} catch {
  payload = {};
}

try {
  process.exitCode = await runDoorbellWaiter({ payload, root: flags.root });
} catch (error) {
  // A broken waiter must never wake the session with an error.
  process.exitCode = 0;
  if (process.env.EPIC_LOOP_DEBUG) console.error(error);
}
