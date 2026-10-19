#!/usr/bin/env node

// Prints the id index of an epic (D27): where each T/D/H/R/Q id is defined, plus aliases
// (hyphenated mentions), duplicate definitions and mentions of unknown ids.
// Usage: id-index.mjs --slug <slug> [--json] [--root <dir>]
import process from "node:process";

import { epicRoot, parseArgs, requireFlag, resolveRoot, runCli } from "./lib/common.mjs";
import { buildIdIndex } from "./lib/id-index.mjs";

runCli(() => {
  const { flags } = parseArgs(process.argv.slice(2));
  const root = resolveRoot(flags.root);
  const slug = requireFlag(flags, "slug");
  const index = buildIdIndex(epicRoot(root, slug));
  if (flags.json) {
    console.log(JSON.stringify(index, null, 2));
    return;
  }
  const counts = {};
  for (const id of Object.keys(index.ids)) counts[id[0]] = (counts[id[0]] ?? 0) + 1;
  console.log(`Ids in ${slug}: ${["T", "D", "H", "R", "Q"].map((kind) => `${kind} ${counts[kind] ?? 0}`).join(", ")}`);
  for (const duplicate of index.duplicates) {
    console.log(`Duplicate ${duplicate.id}: ${duplicate.first.file}:${duplicate.first.line} and ${duplicate.second.file}:${duplicate.second.line}`);
  }
  const unknown = [...new Set(index.unknown.map((mention) => mention.id))];
  if (unknown.length > 0) console.log(`Mentioned but not defined: ${unknown.join(", ")}`);
});
