import fs from "node:fs";
import path from "node:path";

import { ensureDir, epicRoot, epicRuntimeRoot, nowIso, requireFlag, resolveRoot } from "./common.mjs";

export function appendImplementationLog(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const entry = {
    timestamp: flags.timestamp || nowIso(),
    phase: flags.phase || null,
    task: flags.task || null,
    verdict: flags.verdict || null,
    changed: splitList(flags.changed),
    verification: splitList(flags.verification),
    residual_risk: flags.risk || flags["residual-risk"] || null,
    commit: flags.commit || null,
    next_move: flags["next-move"] || null,
  };

  appendJsonLine(path.join(epicRuntimeRoot(root, slug), "implementation-log.jsonl"), entry);
  appendMarkdown(path.join(epicRoot(root, slug), "implementation-log.md"), entry);
  console.log(`Appended implementation log entry for ${slug}.`);
}

export function readImplementationLogTail(flags = {}) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const count = Number(flags.last ?? 3);
  const filePath = path.join(epicRoot(root, slug), "implementation-log.md");

  if (!fs.existsSync(filePath)) {
    return;
  }

  const sections = fs
    .readFileSync(filePath, "utf8")
    .split(/\n(?=##\s+)/u)
    .filter((section) => section.trim().startsWith("## "));
  console.log(sections.slice(-Math.max(1, count)).join("\n").trim());
}

function appendMarkdown(filePath, entry) {
  ensureDir(path.dirname(filePath));
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "# Implementation Log\n", "utf8");
  }

  fs.appendFileSync(
    filePath,
    [
      "",
      `## ${entry.timestamp} - ${entry.verdict || entry.task || "Implementation Update"}`,
      "",
      ...(entry.phase ? [`- Phase: ${entry.phase}`] : []),
      ...(entry.task ? [`- Task: ${entry.task}`] : []),
      ...(entry.verdict ? [`- Verdict: ${entry.verdict}`] : []),
      ...formatList("Changed", entry.changed),
      ...formatList("Verification", entry.verification),
      ...(entry.residual_risk ? [`- Residual risk: ${entry.residual_risk}`] : []),
      ...(entry.commit ? [`- Commit: ${entry.commit}`] : []),
      ...(entry.next_move ? [`- Next move: ${entry.next_move}`] : []),
      "",
    ].join("\n"),
    "utf8",
  );
}

function formatList(label, values) {
  if (values.length === 0) {
    return [];
  }
  if (values.length === 1) {
    return [`- ${label}: ${values[0]}`];
  }
  return [`- ${label}:`, ...values.map((value) => `  - ${value}`)];
}

function splitList(value) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  return value
    .split(/\s*;\s*/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function appendJsonLine(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}
