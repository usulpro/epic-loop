#!/usr/bin/env node
// Snapshot a file every time its content changes, so overwritten state (e.g. runtime-state.json)
// keeps a history. Usage: state-history.mjs <file> <out-dir> [interval-ms]. Runs until killed.
import fs from "node:fs";
import path from "node:path";

const [file, outDir, intervalArg] = process.argv.slice(2);
if (!file || !outDir) {
  console.error("Usage: state-history.mjs <file> <out-dir> [interval-ms]");
  process.exit(2);
}

fs.mkdirSync(outDir, { recursive: true });
let last = null;
let seq = 0;

setInterval(() => {
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  if (content === last) {
    return;
  }
  last = content;
  seq += 1;
  const stamp = new Date().toISOString().replace(/[-:]/gu, "").replace(".", "-");
  fs.writeFileSync(path.join(outDir, `${String(seq).padStart(4, "0")}-${stamp}-${path.basename(file)}`), content);
}, Number(intervalArg) || 150);
