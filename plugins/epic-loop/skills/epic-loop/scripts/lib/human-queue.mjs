import fs from "node:fs";
import path from "node:path";

import { epicRoot, nowIso, requireFlag, resolveRoot } from "./common.mjs";

// Hold kinds (decision D26 of the visual-review epic).
export const HOLD_KINDS = ["checkpoint", "costly-decision", "security-hold", "human-action", "product-decision", "external-wait"];

const HEADER = [
  "# Human Queue",
  "",
  "What the implementation loop needs from the human without stopping for it. Written by `scripts/human-queue.mjs`; ids `H<n>` are stable and never reused.",
];
const OPEN_FIELDS = ["Kind", "Ask", "Why", "Default", "Blocks", "Raised"];
const RESOLVED_FIELDS = [...OPEN_FIELDS, "Resolved", "Resolution"];

export function humanQueuePath(projectRoot, slug) {
  return path.join(epicRoot(projectRoot, slug), "human-queue.md");
}

// Reads never create the file: an epic without a queue simply has no items.
export function readHumanQueue(projectRoot, slug) {
  const filePath = humanQueuePath(projectRoot, slug);
  return fs.existsSync(filePath) ? parseHumanQueue(fs.readFileSync(filePath, "utf8")) : [];
}

export function renderHumanQueue(items) {
  const open = items.filter((item) => item.status === "open");
  const resolved = items.filter((item) => item.status === "resolved");
  return [...HEADER, "", "## Open", "", ...renderSection(open, OPEN_FIELDS), "", "## Resolved", "", ...renderSection(resolved, RESOLVED_FIELDS), ""].join("\n");
}

export function parseHumanQueue(text) {
  const items = [];
  let section = null;
  let current = null;

  for (const line of text.split(/\r?\n/u)) {
    const heading = line.match(/^##\s+(Open|Resolved)\s*$/u);
    if (heading) {
      section = heading[1] === "Open" ? "open" : "resolved";
      current = null;
      continue;
    }

    const itemMatch = line.match(/^- \*\*H(\d+)\*\*\s*$/u);
    if (itemMatch && section) {
      current = { id: `H${itemMatch[1]}`, number: Number(itemMatch[1]), status: section };
      items.push(current);
      continue;
    }

    const field = line.match(/^ {2}- ([A-Z][a-z]+): (.*)$/u);
    if (field && current && RESOLVED_FIELDS.includes(field[1])) {
      current[field[1].toLowerCase()] = field[2];
    }
  }

  return items;
}

export function humanQueueCommand(flags = {}, positionals = []) {
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const command = positionals[0];

  if (command === "add") {
    return addItem(root, slug, flags);
  }
  if (command === "list") {
    return listItems(root, slug, flags);
  }
  if (command === "resolve") {
    return resolveItem(root, slug, flags);
  }
  throw new Error(`Unknown human-queue command "${command ?? ""}". Expected one of: add, list, resolve.`);
}

function addItem(root, slug, flags) {
  const kind = requireFlag(flags, "kind").trim();
  if (!HOLD_KINDS.includes(kind)) {
    throw new Error(`Invalid --kind "${kind}". Expected one of: ${HOLD_KINDS.join(", ")}.`);
  }

  const items = readHumanQueue(root, slug);
  const number = Math.max(0, ...items.map((item) => item.number)) + 1;
  const item = {
    ask: oneLine(requireFlag(flags, "ask")),
    blocks: oneLine(requireFlag(flags, "blocks")),
    default: typeof flags.default === "string" && flags.default.trim() ? oneLine(flags.default) : "none",
    id: `H${number}`,
    kind,
    number,
    raised: today(),
    status: "open",
    why: oneLine(requireFlag(flags, "why")),
  };

  writeQueue(root, slug, [...items, item]);
  console.log(item.id);
}

function listItems(root, slug, flags) {
  const items = readHumanQueue(root, slug)
    .filter((item) => flags.all || item.status === "open")
    .sort((left, right) => left.number - right.number);
  if (flags.json) {
    console.log(JSON.stringify(items.map(publicItem), null, 2));
    return;
  }
  if (items.length === 0) {
    console.log(flags.all ? "No human-queue items." : "No open human-queue items.");
    return;
  }
  for (const item of items) {
    console.log(`${item.id} [${item.status}] ${item.kind}: ${item.ask} (blocks: ${item.blocks})`);
  }
}

function resolveItem(root, slug, flags) {
  const id = requireFlag(flags, "id").trim().toUpperCase();
  const resolution = oneLine(requireFlag(flags, "resolution"));
  const items = readHumanQueue(root, slug);
  const item = items.find((entry) => entry.id === id);

  if (!item) {
    throw new Error(`Human-queue item not found: ${id}`);
  }
  if (item.status !== "open") {
    throw new Error(`Human-queue item ${id} is already resolved.`);
  }

  Object.assign(item, { resolution, resolved: today(), status: "resolved" });
  writeQueue(root, slug, items);
  console.log(`Resolved ${id}.`);
}

function writeQueue(root, slug, items) {
  const sorted = [...items].sort((left, right) => left.number - right.number);
  fs.writeFileSync(humanQueuePath(root, slug), renderHumanQueue(sorted), "utf8");
}

function renderSection(items, fields) {
  if (items.length === 0) {
    return ["- None."];
  }
  return items.flatMap((item) => [`- **${item.id}**`, ...fields.map((field) => `  - ${field}: ${item[field.toLowerCase()] ?? ""}`)]);
}

function publicItem(item) {
  const { number: _number, ...rest } = item;
  return rest;
}

function oneLine(value) {
  return String(value)
    .trim()
    .replace(/\s*\n\s*/gu, " ");
}

function today() {
  return nowIso().slice(0, 10);
}
