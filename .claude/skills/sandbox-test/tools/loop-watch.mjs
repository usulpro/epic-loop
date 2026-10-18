#!/usr/bin/env node
// Streams one line per implementation-loop event (turns, role commands, stop-gate reviews, skips) and per fixture marker, for a Monitor.
// Usage: loop-watch.mjs <sandbox-dir> <epic-slug>. Runs until killed; tolerates files that do not exist yet.
import fs from "node:fs";

const [sandbox, slug] = process.argv.slice(2);
if (!sandbox || !slug) {
  console.error("Usage: loop-watch.mjs <sandbox-dir> <epic-slug>");
  process.exit(2);
}

const files = { progress: `${sandbox}/.epic-loop/epics/${slug}/.runtime/progress-log.jsonl`, marker: `${sandbox}/.sandbox/markers.log` };
const offsets = { progress: 0, marker: 0 };
const ACTIONS = new Set(["turn-start", "turn-stop", "turn-waiting-background", "turn-aborted", "turn-interrupted", "synthetic-prompt-ignored", "user-message-in-turn", "skip", "loop-stopped", "role-command", "user-message-while-waiting", "stop-gate"]);
const FIELDS = ["command", "role", "current_role", "iteration", "next_role", "reason", "status", "background_task_ids", "turn_key_adopted"];

// Manager stop reviews: `stop-gate class="B" outcome="challenged" round=1 iteration=5 [report="…"] [instruction="…"]`.
const STOP_GATE_FIELDS = [
  ["class", "class"],
  ["outcome", "outcome"],
  ["round", "round"],
  ["iteration", "iteration"],
  ["report", "report_path"],
  ["instruction", "instruction"],
];

function describe(event) {
  if (event.action === "stop-gate") {
    return STOP_GATE_FIELDS.filter(([, key]) => event[key] !== undefined && event[key] !== null)
      .map(([name, key]) => `${name}=${JSON.stringify(key === "instruction" ? String(event[key]).slice(0, 160) : event[key])}`)
      .join(" ");
  }
  return FIELDS.filter((key) => event[key] !== undefined && event[key] !== null)
    .map((key) => `${key}=${JSON.stringify(event[key])}`)
    .join(" ");
}

setInterval(() => {
  for (const [kind, file] of Object.entries(files)) {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const fresh = text.slice(offsets[kind]);
    const end = fresh.lastIndexOf("\n");
    if (end < 0) {
      continue;
    }
    offsets[kind] += end + 1;
    for (const line of fresh.slice(0, end).split("\n")) {
      if (kind === "marker") {
        console.log(`marker: ${line}`);
        continue;
      }
      try {
        const event = JSON.parse(line);
        if (ACTIONS.has(event.action)) {
          console.log(`${String(event.timestamp ?? "").slice(11, 19)} ${event.action} ${describe(event)}`);
        }
      } catch {
        // partial line; picked up on the next tick
      }
    }
  }
}, 500);
