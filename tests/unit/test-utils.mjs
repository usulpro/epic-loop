import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const scriptsRoot = path.join(repoRoot, "plugins", "epic-loop", "skills", "epic-loop", "scripts");

export function scriptPath(name) {
  return path.join(scriptsRoot, name);
}

export function makeTempRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `epic-loop-${prefix}-`));
}

export function runNodeScript(scriptName, args = [], options = {}) {
  return spawnSync(process.execPath, [scriptPath(scriptName), ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    input: options.input,
  });
}

export function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function assertSuccess(result) {
  assert.equal(result.status, 0, result.stderr);
}
