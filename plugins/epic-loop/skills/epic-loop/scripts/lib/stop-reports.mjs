import fs from "node:fs";
import path from "node:path";

import { ensureDir, epicRoot, nowIso } from "./common.mjs";

// A justified stop ends with a report for the human, measured against the epic's intent
// (decision D3). The English copy is saved in the epic; the chat message is in the user's
// language (D9).
export const STOP_REPORT_HEADINGS = [
  "## Where The Epic Stands",
  "## Achieved Since The Last Report",
  "## Why The Loop Stopped",
  "## What You Need To Do Or Decide",
  "## Agent-Made Decisions To Confirm",
  "## Next And How To Resume",
];
const STOP_REPORTS_DIR = "stop-reports";
const REPORT_FILE = /^(\d+)-\d{4}-\d{2}-\d{2}-class-[A-F]\.md$/u;

export function missingStopReportHeadings(body) {
  const lines = new Set(
    String(body ?? "")
      .split(/\r?\n/u)
      .map((line) => line.trim()),
  );
  return STOP_REPORT_HEADINGS.filter((heading) => !lines.has(heading));
}

export function saveStopReport(projectRoot, slug, { body, stopClass, reason }) {
  const dir = path.join(epicRoot(projectRoot, slug), STOP_REPORTS_DIR);
  const number = Math.max(0, ...listStopReports(projectRoot, slug).map((file) => Number(file.match(REPORT_FILE)[1]))) + 1;
  const date = nowIso().slice(0, 10);
  const fileName = `${String(number).padStart(2, "0")}-${date}-class-${stopClass}.md`;
  const text = [`# Stop Report ${String(number).padStart(2, "0")}`, "", `- Date: ${date}`, `- Stop class: ${stopClass}`, `- Techlead reason: ${reason}`, "", body.trim(), ""].join(
    "\n",
  );

  ensureDir(dir);
  fs.writeFileSync(path.join(dir, fileName), text, "utf8");
  return path.relative(projectRoot, path.join(dir, fileName));
}

// The newest saved report, relative to the project root, or null.
export function latestStopReportPath(projectRoot, slug) {
  const latest = listStopReports(projectRoot, slug).at(-1);
  return latest ? path.relative(projectRoot, path.join(epicRoot(projectRoot, slug), STOP_REPORTS_DIR, latest)) : null;
}

function listStopReports(projectRoot, slug) {
  const dir = path.join(epicRoot(projectRoot, slug), STOP_REPORTS_DIR);
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((file) => REPORT_FILE.test(file))
    .sort((left, right) => Number(left.match(REPORT_FILE)[1]) - Number(right.match(REPORT_FILE)[1]));
}
