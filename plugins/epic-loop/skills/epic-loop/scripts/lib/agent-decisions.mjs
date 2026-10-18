import fs from "node:fs";
import path from "node:path";

import { epicRoot, nowIso, requireFlag, resolveRoot } from "./common.mjs";
import { STOP_CLASSES } from "./loop-stop-gate.mjs";

export const DECISION_LOG_TEMPLATE = `# Decision Log

## Active Decisions

- None recorded yet.

## Historical Decisions

- None recorded yet.
`;

const ACTIVE_HEADING = "## Active Decisions";
const EMPTY_PLACEHOLDER = "- None recorded yet.";
// - **D31 — <title>** (2026-10-18; agent-made, stop class C; unconfirmed).
const ENTRY_PATTERN = /^- \*\*D(\d+) — (.+)\*\* \((\d{4}-\d{2}-\d{2}); agent-made, stop class ([A-F]); (unconfirmed|confirmed \d{4}-\d{2}-\d{2}|reversed \d{4}-\d{2}-\d{2})\)\.$/u;

export function decisionLogPath(projectRoot, slug) {
  return path.join(epicRoot(projectRoot, slug), "decision-log.md");
}

export function readAgentDecisions(projectRoot, slug) {
  const filePath = decisionLogPath(projectRoot, slug);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.match(ENTRY_PATTERN))
    .filter(Boolean)
    .map((match) => ({
      date: match[3],
      id: `D${match[1]}`,
      state: match[5].split(" ")[0],
      stop_class: match[4],
      title: match[2],
    }));
}

export function agentDecisionCommand(flags = {}, positionals = []) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const command = positionals[0];

  if (command === "add") {
    return addDecision(root, slug, flags);
  }
  if (command === "list") {
    return listDecisions(root, slug, flags);
  }
  if (command === "confirm") {
    return confirmDecision(root, slug, flags);
  }
  throw new Error(`Unknown agent-decision command "${command ?? ""}". Expected one of: add, list, confirm.`);
}

// Inserts one entry at the end of the Active Decisions section and leaves every other byte of
// the hand-written log as it was.
function addDecision(root, slug, flags) {
  const title = oneLine(requireFlag(flags, "title"));
  const chosenDefault = oneLine(requireFlag(flags, "default"));
  const why = oneLine(requireFlag(flags, "why"));
  const stopClass = typeof flags["stop-class"] === "string" ? flags["stop-class"].trim().toUpperCase() : "C";
  if (!STOP_CLASSES.includes(stopClass)) {
    throw new Error(`Invalid --stop-class "${flags["stop-class"]}". Expected one of: ${STOP_CLASSES.join(", ")}.`);
  }

  const filePath = decisionLogPath(root, slug);
  const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : DECISION_LOG_TEMPLATE;
  const number = Math.max(0, ...[...text.matchAll(/\bD(\d+)\b/gu)].map((match) => Number(match[1]))) + 1;
  const entry = [`- **D${number} — ${title}** (${today()}; agent-made, stop class ${stopClass}; unconfirmed).`, `  - Default taken: ${chosenDefault}`, `  - Why: ${why}`];

  fs.writeFileSync(filePath, insertIntoActiveSection(text, entry), "utf8");
  console.log(`D${number}`);
}

function insertIntoActiveSection(text, entry) {
  const lines = text.split("\n");
  const start = lines.indexOf(ACTIVE_HEADING);
  if (start === -1) {
    const separator = text.length === 0 || text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : "\n\n";
    return `${text}${separator}${ACTIVE_HEADING}\n\n${entry.join("\n")}\n`;
  }

  const nextHeading = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const end = nextHeading === -1 ? lines.length : nextHeading;
  const body = lines.slice(start + 1, end);
  const nonBlank = body.map((line) => line.trim()).filter(Boolean);

  // The template's placeholder is the only line the entry replaces.
  if (nonBlank.length === 1 && nonBlank[0] === EMPTY_PLACEHOLDER) {
    const placeholder = start + 1 + body.findIndex((line) => line.trim() === EMPTY_PLACEHOLDER);
    return [...lines.slice(0, placeholder), ...entry, ...lines.slice(placeholder + 1)].join("\n");
  }

  let last = end - 1;
  while (last > start && lines[last].trim() === "") {
    last -= 1;
  }
  const insertAt = last + 1;
  const prefix = last === start ? [""] : [];
  const suffix = insertAt === lines.length ? [""] : [];
  return [...lines.slice(0, insertAt), ...prefix, ...entry, ...suffix, ...lines.slice(insertAt)].join("\n");
}

function listDecisions(root, slug, flags) {
  const decisions = readAgentDecisions(root, slug).filter((decision) => !flags.unconfirmed || decision.state === "unconfirmed");
  if (flags.json) {
    console.log(JSON.stringify(decisions, null, 2));
    return;
  }
  if (decisions.length === 0) {
    console.log(flags.unconfirmed ? "No unconfirmed agent-made decisions." : "No agent-made decisions.");
    return;
  }
  for (const decision of decisions) {
    console.log(`${decision.id} [${decision.state}] ${decision.title} (stop class ${decision.stop_class}, ${decision.date})`);
  }
}

function confirmDecision(root, slug, flags) {
  const id = requireFlag(flags, "id").trim().toUpperCase();
  const reversed = typeof flags.reversed === "string" && flags.reversed.trim() ? oneLine(flags.reversed) : null;
  const note = typeof flags.note === "string" && flags.note.trim() ? oneLine(flags.note) : null;
  const filePath = decisionLogPath(root, slug);
  const lines = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").split("\n") : [];
  const index = lines.findIndex((line) => line.match(ENTRY_PATTERN) && line.startsWith(`- **${id} — `));

  if (index === -1) {
    throw new Error(`Agent-made decision not found: ${id}`);
  }
  if (!lines[index].endsWith("; unconfirmed).")) {
    throw new Error(`Agent-made decision ${id} is already confirmed or reversed.`);
  }

  const state = reversed ? `reversed ${today()}` : `confirmed ${today()}`;
  lines[index] = lines[index].replace(/; unconfirmed\)\.$/u, `; ${state}).`);

  let last = index;
  while (lines[last + 1]?.startsWith("  ")) {
    last += 1;
  }
  const extra = [...(reversed ? [`  - Reversed: ${reversed}`] : []), ...(note ? [`  - Note: ${note}`] : [])];
  lines.splice(last + 1, 0, ...extra);

  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  console.log(`${reversed ? "Reversed" : "Confirmed"} ${id}.`);
}

function oneLine(value) {
  return String(value)
    .trim()
    .replace(/\s*\n\s*/gu, " ");
}

function today() {
  return nowIso().slice(0, 10);
}
