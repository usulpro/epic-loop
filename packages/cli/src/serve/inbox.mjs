import fs from "node:fs";
import path from "node:path";

import { enqueue } from "./answers.mjs";

// The epic inbox (D22): requests the human sends to the running loop from the epic home.
// One JSON line per entry in .epic-loop/epics/<slug>/inbox.jsonl: { id: "I<n>", text, createdAt }.
// The loop picks new entries up at its next role transition.
export const INBOX_TEXT_LIMIT = 4000;

function inboxFile(epicDir) {
  return path.join(epicDir, "inbox.jsonl");
}

export function readInbox(epicDir) {
  let text;
  try {
    text = fs.readFileSync(inboxFile(epicDir), "utf8");
  } catch {
    return [];
  }
  const entries = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry && typeof entry.id === "string" && /^I\d+$/u.test(entry.id)) entries.push(entry);
    } catch {}
  }
  return entries;
}

export function appendInbox(epicDir, text) {
  return enqueue(inboxFile(epicDir), () => {
    const last = Math.max(0, ...readInbox(epicDir).map((entry) => Number(entry.id.slice(1))));
    const entry = { id: `I${last + 1}`, text, createdAt: new Date().toISOString() };
    fs.appendFileSync(inboxFile(epicDir), `${JSON.stringify(entry)}\n`);
    return entry;
  });
}
