#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsRoot, "..");
const baselineRoot = path.join(scriptsRoot, "eval-fixture-baseline");
const epicRoot = path.join(repoRoot, ".epic-loop", "epics", "eval-fixture");
const fixtureRoot = path.join(repoRoot, "temp", "eval-fixture-project");

function assertInsideRepo(targetPath) {
  const relative = path.relative(repoRoot, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to touch path outside repository: ${targetPath}`);
  }
}

if (!fs.existsSync(baselineRoot)) {
  throw new Error(`Missing eval fixture baseline artifact: ${baselineRoot}`);
}

assertInsideRepo(epicRoot);
assertInsideRepo(fixtureRoot);

fs.rmSync(epicRoot, { recursive: true, force: true });
fs.rmSync(fixtureRoot, { recursive: true, force: true });
fs.cpSync(baselineRoot, epicRoot, { recursive: true, force: true });

console.log("Reset eval-fixture epic baseline.");
console.log("Copied scripts/eval-fixture-baseline to .epic-loop/epics/eval-fixture.");
console.log("Removed temp/eval-fixture-project.");
