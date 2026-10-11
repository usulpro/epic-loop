#!/usr/bin/env node
// Prints a compact timeline (text, tool calls, results, attachments such as hook context and
// Stop-hook continuations) of the Claude Code transcript for a sandbox.
// Usage: transcript-timeline.mjs <sandbox-dir> [from HH:MM:SS] [to HH:MM:SS]   (UTC, as in the transcript)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [sandbox, from = "00:00:00", to = "99:99:99"] = process.argv.slice(2);
if (!sandbox) {
  console.error("Usage: transcript-timeline.mjs <sandbox-dir> [from HH:MM:SS] [to HH:MM:SS]");
  process.exit(2);
}

const dir = path.join(os.homedir(), ".claude", "projects", path.resolve(sandbox).replace(/[^A-Za-z0-9]/gu, "-"));
const cut = (value, size) => String(value).replace(/\s+/gu, " ").slice(0, size);

for (const name of fs.readdirSync(dir).filter((file) => file.endsWith(".jsonl"))) {
  for (const line of fs.readFileSync(path.join(dir, name), "utf8").trim().split("\n")) {
    const entry = JSON.parse(line);
    const time = String(entry.timestamp ?? "").slice(11, 19);
    if (!time || time < from || time > to) {
      continue;
    }
    if (entry.attachment) {
      console.log(`${time} [attach] ${cut(JSON.stringify(entry.attachment), 260)}`);
      continue;
    }
    const message = entry.message;
    if (!message) {
      continue;
    }
    const blocks = typeof message.content === "string" ? [{ type: "text", text: message.content }] : (message.content ?? []);
    for (const block of blocks) {
      if (block.type === "text") {
        console.log(`${time} ${message.role}: ${cut(block.text, 400)}`);
      } else if (block.type === "tool_use") {
        const input = block.input ?? {};
        console.log(`${time} tool ${block.name}${input.run_in_background ? " [bg]" : ""}: ${cut(input.command ?? input.file_path ?? JSON.stringify(input), 220)}`);
      } else if (block.type === "tool_result") {
        console.log(`${time} result: ${cut(typeof block.content === "string" ? block.content : JSON.stringify(block.content), 160)}`);
      }
    }
  }
}
